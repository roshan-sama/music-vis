// keypoint-analysis-presentation.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';

interface Keypoint {
  x: number;
  y: number;
  confidence: number;
}

interface FrameData {
  keypoints: Keypoint[];
}

const SKELETON_CONNECTIONS = [
  [0, 1], // Neck
  [1, 2],
  [2, 3],
  [3, 4], // Right arm
  [1, 5],
  [5, 6],
  [6, 7], // Left arm
  [1, 8], // Spine
  [8, 9],
  [8, 10],
  [9, 10],
  [10, 11], // Right leg
  [8, 12],
  [8, 13],
  [12, 13],
  [13, 14], // Left leg
];

@Component({
  selector: 'app-keypoint-analysis-presentation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="keypoint-container">
      <div *ngIf="isLoading" class="loading-overlay">
        <div class="loading-content">
          <h3>Loading Frames...</h3>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="loadingProgress"></div>
          </div>
          <p>{{ loadingProgress.toFixed(1) }}%</p>
        </div>
      </div>

      <div class="canvas-wrapper">
        <canvas #canvas></canvas>
      </div>

      <div class="info-overlay">
        <h3>Keypoint Analysis</h3>
        <p>Frame: {{ currentFrame }} / {{ totalFrames - 1 }}</p>
      </div>
    </div>
  `,
  styleUrls: ['./keypoint-analysis-presentation.component.css'],
})
export class KeypointAnalysisPresentationComponent
  implements OnInit, OnDestroy
{
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() analysisId!: string;
  @Input() frameRate = 30;
  @Input() set externalTime(time: number) {
    // if (this.externalPlaying) {
    //   return;
    // }
    if (time !== undefined && !this.isLoading) {
      const frame = Math.floor(time * this.frameRate);
      this.seekToFrame(frame);
    }
  }
  @Input() set externalPlaying(playing: boolean) {
    if (playing !== undefined) {
      this.isPlaying = playing;
      if (playing) {
        this.startPlayback();
      } else {
        this.stopPlayback();
      }
    }
  }

  @Output() frameChange = new EventEmitter<number>();
  @Output() framesLoaded = new EventEmitter<number>();

  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;

  currentFrame = 0;
  totalFrames = 420; //500;
  isPlaying = false;

  private lastFrameTime = 0;

  private frames: HTMLImageElement[] = [];
  private frameData: FrameData[] = [];
  private loadedFrames = 0;

  isLoading = true;
  loadingProgress = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    canvas.width = 1920;
    canvas.height = 1080;

    this.loadFrames();
  }

  ngOnDestroy(): void {
    this.stopPlayback();
  }

  private async loadFrames(): Promise<void> {
    const loadPromises: Promise<void>[] = [];
    const basePath = `assets/${this.analysisId}`;

    for (let i = 0; i < this.totalFrames; i++) {
      const frameNum = i.toString().padStart(6, '0');

      const imgPromise = new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.frames[i] = img;
          this.loadedFrames++;
          this.loadingProgress =
            (this.loadedFrames / (this.totalFrames * 2)) * 100;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load frame ${frameNum}`);
          resolve();
        };
        img.src = `${basePath}/${frameNum}.jpg`;
      });

      const jsonPromise = lastValueFrom(
        this.http.get<any>(`${basePath}/${frameNum}.json`)
      )
        .then((data) => {
          if (data && data.annots && data.annots.length > 0) {
            const keypoints: Keypoint[] = data.annots[0].keypoints.map(
              (kp: number[]) => ({
                x: kp[0],
                y: kp[1],
                confidence: kp[2],
              })
            );
            this.frameData[i] = { keypoints };
          }
          this.loadedFrames++;
          this.loadingProgress =
            (this.loadedFrames / (this.totalFrames * 2)) * 100;
        })
        .catch((err) => {
          console.warn(`Failed to load data for frame ${frameNum}`, err);
        });

      loadPromises.push(imgPromise, jsonPromise);
    }

    await Promise.all(loadPromises);
    this.isLoading = false;
    this.framesLoaded.emit(this.totalFrames);
    this.renderFrame();
  }

  private renderFrame(): void {
    const frame = this.frames[this.currentFrame];
    if (!frame) return;

    this.ctx.clearRect(
      0,
      0,
      this.canvasRef.nativeElement.width,
      this.canvasRef.nativeElement.height
    );
    this.ctx.drawImage(frame, 0, 0);

    const data = this.frameData[this.currentFrame];
    if (data && data.keypoints) {
      this.drawSkeleton(data.keypoints);
    }
  }

  private drawSkeleton(keypoints: Keypoint[]): void {
    const minConfidence = 0.3;

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

    keypoints.forEach((kp) => {
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

    const frameDuration = 1000 / this.frameRate;

    if (timestamp - this.lastFrameTime >= frameDuration) {
      this.lastFrameTime = timestamp;
      this.currentFrame++;

      if (this.currentFrame >= this.totalFrames) {
        this.currentFrame = 0;
      }

      this.renderFrame();
      this.frameChange.emit(this.currentFrame / this.frameRate);
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private startPlayback(): void {
    if (!this.animationFrameId) {
      this.lastFrameTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.animate);
    }
  }

  private stopPlayback(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  seekToFrame(frame: number): void {
    this.currentFrame = Math.max(0, Math.min(frame, this.totalFrames - 1));
    this.renderFrame();
    this.frameChange.emit(this.currentFrame / this.frameRate);
  }
}
