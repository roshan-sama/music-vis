// dance-video-player.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Keypoint {
  x: number;
  y: number;
  confidence: number;
}

interface FrameData {
  keypoints: Keypoint[];
}

// Body keypoint connections for skeleton visualization (COCO format)
const SKELETON_CONNECTIONS = [
  [0,1], 
  [1,2], [2, 3], [3,4], // Right arm
  [1,5], [5,6], [6,7],  // Left arm
  [1,8], // Spine
  [8,9], [8,10],[9,10], [10,11], // Right leg
  [8,12],[8,13], [12,13],[13,14], // Left leg
];

@Component({
  selector: 'app-keypoint-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './keypoint-overlay.component.html',
  styleUrls: ['./keypoint-overlay.component.css']
})
export class KeypointOverlayComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;
  
  // Video state
  currentFrame = 0;
  totalFrames = 500; // Adjust based on your actual number of frames
  isPlaying = false;
  
  // Frame rate options
  frameRates = [15, 24, 30, 60];
  selectedFrameRate = 30;
  private lastFrameTime = 0;
  
  // Data
  private frames: HTMLImageElement[] = [];
  private frameData: FrameData[] = [];
  private loadedFrames = 0;
  
  // Loading state
  isLoading = true;
  loadingProgress = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    
    // Set canvas size (matching your video dimensions)
    canvas.width = 1920;
    canvas.height = 1080;
    
    this.loadFrames();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private async loadFrames(): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    for (let i = 0; i < this.totalFrames; i++) {
      const frameNum = i.toString().padStart(6, '0');
      
      // Load image
      const imgPromise = new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.frames[i] = img;
          this.loadedFrames++;
          this.loadingProgress = (this.loadedFrames / (this.totalFrames * 2)) * 100;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load frame ${frameNum}`);
          resolve(); // Continue even if frame fails
        };
        img.src = `assets/dance-video/${frameNum}.jpg`;
      });

      // Load JSON data
      const jsonPromise = this.http.get<any>(`assets/dance-video/${frameNum}.json`)
        .toPromise()
        .then(data => {
          if (data && data.annots && data.annots.length > 0) {
            const keypoints: Keypoint[] = data.annots[0].keypoints.map((kp: number[]) => ({
              x: kp[0],
              y: kp[1],
              confidence: kp[2]
            }));
            this.frameData[i] = { keypoints };
          }
          this.loadedFrames++;
          this.loadingProgress = (this.loadedFrames / (this.totalFrames * 2)) * 100;
        })
        .catch(err => {
          console.warn(`Failed to load data for frame ${frameNum}`, err);
        });

      loadPromises.push(imgPromise, jsonPromise);
    }

    await Promise.all(loadPromises);
    this.isLoading = false;
    this.renderFrame();
  }

  private renderFrame(): void {
    const frame = this.frames[this.currentFrame];
    if (!frame) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    
    // Draw image
    this.ctx.drawImage(frame, 0, 0);
    
    // Draw skeleton
    const data = this.frameData[this.currentFrame];
    if (data && data.keypoints) {
      this.drawSkeleton(data.keypoints);
    }
  }

  private drawSkeleton(keypoints: Keypoint[]): void {
    const minConfidence = 0.3; // Minimum confidence threshold

    // Draw skeleton connections
    this.ctx.strokeStyle = '#00ff00';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';

    SKELETON_CONNECTIONS.forEach(([start, end]) => {
      if (start < keypoints.length && end < keypoints.length) {
        const kp1 = keypoints[start];
        const kp2 = keypoints[end];
        
        if (kp1.confidence > minConfidence && kp2.confidence > minConfidence) {
          this.ctx.beginPath();
          this.ctx.moveTo(kp1.x, kp1.y);
          this.ctx.lineTo(kp2.x, kp2.y);
          this.ctx.stroke();
        }
      }
    });

    // Draw keypoints
    keypoints.forEach(kp => {
      if (kp.confidence > minConfidence) {
        this.ctx.fillStyle = '#ff0000';
        this.ctx.beginPath();
        this.ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    });
  }

  private animate = (timestamp: number): void => {
    if (!this.isPlaying) return;

    const frameDuration = 1000 / this.selectedFrameRate;
    
    if (timestamp - this.lastFrameTime >= frameDuration) {
      this.lastFrameTime = timestamp;
      this.currentFrame++;
      
      if (this.currentFrame >= this.totalFrames) {
        this.currentFrame = 0; // Loop
      }
      
      this.renderFrame();
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  togglePlayPause(): void {
    this.isPlaying = !this.isPlaying;
    
    if (this.isPlaying) {
      this.lastFrameTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.animate);
    } else if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  nextFrame(): void {
    if (this.currentFrame < this.totalFrames - 1) {
      this.currentFrame++;
      this.renderFrame();
    }
  }

  previousFrame(): void {
    if (this.currentFrame > 0) {
      this.currentFrame--;
      this.renderFrame();
    }
  }

  seekToFrame(frame: number): void {
    this.currentFrame = Math.max(0, Math.min(frame, this.totalFrames - 1));
    this.renderFrame();
  }

  onFrameRateChange(): void {
    // Frame rate change takes effect on next animation frame
  }

  onSliderChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.seekToFrame(parseInt(value, 10));
  }
}