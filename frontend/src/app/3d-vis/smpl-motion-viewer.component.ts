// smpl-motion-viewer.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { lastValueFrom } from 'rxjs';

interface Person {
  id: number;
  vertices: number[][];
  Th: number[][];
  Rh: number[][];
}

interface Topology {
  faces: number[][];
  num_vertices: number;
}

@Component({
  selector: 'app-smpl-motion-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="viewer-container" *ngIf="!isLoading">
      <div class="canvas-wrapper">
        <canvas #videoCanvas [width]="2132" [height]="1772"></canvas>
        <canvas #meshCanvas [width]="2132" [height]="1772"></canvas>
      </div>

      <div class="controls">
        <div class="timeline" (click)="onTimelineClick($event)">
          <div
            class="timeline-progress"
            [style.width.%]="progressPercent"
          ></div>
          <div class="timeline-label">
            Frame {{ currentFrame }} / {{ totalFrames - 1 }}
          </div>
        </div>

        <div class="buttons">
          <button
            (click)="togglePlayPause()"
            [class.playing]="isPlaying"
            class="play-button"
          >
            {{ isPlaying ? '⏸ Pause' : '▶ Play' }}
          </button>
        </div>
      </div>
    </div>

    <div class="loading-screen" *ngIf="isLoading">
      <h2>Loading Motion Data...</h2>
      <div class="progress-bar">
        <div class="progress-fill" [style.width.%]="loadProgress"></div>
      </div>
      <p>{{ loadProgress.toFixed(1) }}%</p>
    </div>
  `,
  styles: [
    `
      .viewer-container {
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: #000;
      }

      .canvas-wrapper {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      canvas {
        position: absolute;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      #meshCanvas {
        pointer-events: none;
      }

      .controls {
        background: rgba(0, 0, 0, 0.8);
        padding: 20px;
        border-top: 1px solid #333;
      }

      .timeline {
        width: 100%;
        height: 40px;
        background: #333;
        border-radius: 20px;
        margin-bottom: 15px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
      }

      .timeline-progress {
        height: 100%;
        background: linear-gradient(90deg, #3498db, #2ecc71);
        border-radius: 20px;
        transition: width 0.1s ease;
      }

      .timeline-label {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-weight: bold;
        text-shadow: 0 0 5px black;
      }

      .buttons {
        display: flex;
        justify-content: center;
        gap: 10px;
      }

      .play-button {
        padding: 12px 40px;
        font-size: 16px;
        font-weight: bold;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        background: #2ecc71;
      }

      .play-button.playing {
        background: #e74c3c;
      }

      .play-button:hover {
        transform: scale(1.05);
      }

      .loading-screen {
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #1a1a1a;
        color: white;
      }

      .progress-bar {
        width: 60%;
        height: 30px;
        background: #333;
        border-radius: 15px;
        overflow: hidden;
        margin-top: 20px;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #3498db, #2ecc71);
        transition: width 0.3s ease;
      }
    `,
  ],
})
export class SmplMotionViewerComponent implements OnInit, OnDestroy {
  @ViewChild('videoCanvas', { static: false })
  videoCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('meshCanvas', { static: false })
  meshCanvas!: ElementRef<HTMLCanvasElement>;

  isPlaying = false;
  currentFrame = 0;
  totalFrames = 385;
  isLoading = true;
  loadProgress = 0;
  fps = 30;

  private frameData: Person[][] = [];
  private frameImages: HTMLImageElement[] = [];
  private topology: Topology | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private smplMeshes: THREE.Mesh[] = [];
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private videoCtx: CanvasRenderingContext2D | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  get progressPercent(): number {
    return (this.currentFrame / (this.totalFrames - 1)) * 100;
  }

  private async loadData(): Promise<void> {
    this.isLoading = true;
    const basePath = 'assets/motion-data';

    try {
      // Load topology
      this.topology = await lastValueFrom(
        this.http.get<Topology>(`${basePath}/topology.json`)
      );
      console.log('Loaded topology:', this.topology.num_vertices, 'vertices');

      // Load frames
      const loadPromises: Promise<void>[] = [];

      for (let i = 0; i < this.totalFrames; i++) {
        const frameNum = String(i).padStart(6, '0');

        // Load mesh data
        const jsonPromise = lastValueFrom(
          this.http.get<Person[]>(`${basePath}/${frameNum}.json`)
        )
          .then((data) => {
            this.frameData[i] = data;
          })
          .catch((err) =>
            console.warn(`Failed to load frame ${frameNum}:`, err)
          );

        // Load image
        const imgPromise = new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            this.frameImages[i] = img;
            resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to load image ${frameNum}`);
            resolve();
          };
          img.src = `${basePath}/${frameNum}.jpg`;
        });

        loadPromises.push(jsonPromise, imgPromise);

        if (i % 10 === 0) {
          this.loadProgress = (i / this.totalFrames) * 100;
        }
      }

      await Promise.all(loadPromises);
      this.loadProgress = 100;
      this.isLoading = false;

      // Wait for view to initialize
      setTimeout(() => {
        this.initThreeJS();
        this.renderFrame(0);
      }, 100);
    } catch (error) {
      console.error('Error loading data:', error);
      this.isLoading = false;
    }
  }

  private initThreeJS(): void {
    if (!this.meshCanvas) return;

    const canvas = this.meshCanvas.nativeElement;
    this.videoCtx = this.videoCanvas.nativeElement.getContext('2d');

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      canvas.width / canvas.height,
      0.1,
      100
    );
    this.camera.position.set(0, 1, 5);
    this.camera.lookAt(0, 1, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setClearColor(0x000000, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight1.position.set(5, 5, 5);
    this.scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-5, 3, -5);
    this.scene.add(directionalLight2);

    this.createSMPLMeshes();
  }

  private createSMPLMeshes(): void {
    if (!this.topology || !this.scene) return;

    // Create two meshes (real person + mirror reflection)
    for (let i = 0; i < 2; i++) {
      const geometry = new THREE.BufferGeometry();

      // Set face indices
      const indices = new Uint32Array(this.topology.faces.flat());
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      // Placeholder vertices
      const vertices = new Float32Array(this.topology.num_vertices * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();

      // Material
      const material = new THREE.MeshStandardMaterial({
        color: i === 0 ? 0x3498db : 0xe74c3c,
        roughness: 0.6,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      this.smplMeshes[i] = mesh;
      this.scene.add(mesh);
    }
  }

  private updateMeshVertices(frameIndex: number): void {
    const data = this.frameData[frameIndex];
    if (!data) return;

    data.forEach((person) => {
      const mesh = this.smplMeshes[person.id];
      if (!mesh || !person.vertices) return;

      const geometry = mesh.geometry as THREE.BufferGeometry;
      const positions = geometry.attributes[
        'position'
      ] as THREE.BufferAttribute;
      const flatVertices = person.vertices.flat();

      for (let i = 0; i < flatVertices.length; i++) {
        positions.array[i] = flatVertices[i];
      }

      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    });
  }

  private renderFrame(frameIndex: number): void {
    if (frameIndex < 0 || frameIndex >= this.totalFrames) return;

    // Draw video frame
    const img = this.frameImages[frameIndex];
    if (this.videoCtx && img && this.videoCanvas) {
      const canvas = this.videoCanvas.nativeElement;
      this.videoCtx.clearRect(0, 0, canvas.width, canvas.height);
      this.videoCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    // Update mesh
    this.updateMeshVertices(frameIndex);

    // Render 3D
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    this.currentFrame = frameIndex;
  }

  private animate = (timestamp: number): void => {
    if (!this.isPlaying) return;

    if (!this.lastFrameTime) {
      this.lastFrameTime = timestamp;
    }

    const elapsed = timestamp - this.lastFrameTime;
    const frameDuration = 1000 / this.fps;

    if (elapsed >= frameDuration) {
      this.lastFrameTime = timestamp;
      const nextFrame = (this.currentFrame + 1) % this.totalFrames;
      this.renderFrame(nextFrame);
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  togglePlayPause(): void {
    this.isPlaying = !this.isPlaying;
    this.lastFrameTime = 0;

    if (this.isPlaying) {
      this.animationFrameId = requestAnimationFrame(this.animate);
    } else if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  onTimelineClick(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    const frame = Math.floor(percentage * this.totalFrames);
    this.renderFrame(frame);
    this.isPlaying = false;
  }
}
