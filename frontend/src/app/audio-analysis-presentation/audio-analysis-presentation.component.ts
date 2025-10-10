// audio-analysis-presentation.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as THREE from 'three';
import { Howl } from 'howler';
import { lastValueFrom } from 'rxjs';

interface PitchData {
  time: number;
  dominant_pitches: Array<{ pitch: string; strength: number }>;
}

interface SpectralFeature {
  time: number;
  spectral_centroid: number;
  spectral_rolloff: number;
  zero_crossing_rate: number;
  rms_energy: number;
}

interface AnalysisData {
  pitch_analysis: PitchData[];
  temporal_features: {
    beats: number[];
    spectral_features: SpectralFeature[];
  };
}

@Component({
  selector: 'app-audio-analysis-presentation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="audio-container">
      <div class="canvas-wrapper">
        <canvas #threeCanvas></canvas>
      </div>

      <div class="info-overlay">
        <h3>Audio Analysis</h3>
        <p>3D pitch visualization with beat detection</p>
      </div>
    </div>
  `,
  styles: [
    `
      .audio-container {
        width: 100%;
        height: 100%;
        position: relative;
        background: radial-gradient(
          circle at center,
          #1a1a2e 0%,
          #16213e 50%,
          #0f0f0f 100%
        );
        border-radius: 10px;
        overflow: hidden;
      }

      .canvas-wrapper {
        width: 100%;
        height: 100%;
      }

      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      .info-overlay {
        position: absolute;
        top: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.6);
        padding: 15px 20px;
        border-radius: 8px;
        backdrop-filter: blur(10px);
      }

      .info-overlay h3 {
        margin: 0 0 5px 0;
        color: #4a90e2;
        font-size: 1.2rem;
      }

      .info-overlay p {
        margin: 0;
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.9rem;
      }
    `,
  ],
})
export class AudioAnalysisPresentationComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('threeCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() analysisId!: string;
  @Input() set externalTime(time: number) {
    if (this.sound && this.sound.playing()) {
      return;
    }
    if (time !== undefined && this.sound) {
      this.currentTime = time;
      if (this.sound.playing()) {
        this.sound.seek(time);
      }
      this.updateVisualizationByTime(time);
    }
  }
  @Input() set externalPlaying(playing: boolean) {
    if (playing !== undefined && this.sound) {
      if (playing && !this.sound.playing()) {
        this.sound.play();
      } else if (!playing && this.sound.playing()) {
        this.sound.pause();
      }
    }
  }

  @Output() timeUpdate = new EventEmitter<number>();
  @Output() durationLoaded = new EventEmitter<number>();
  @Output() playStateChange = new EventEmitter<boolean>();

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private sphere!: THREE.Mesh;
  private animationId!: number;

  private sound!: Howl;
  currentTime = 0;
  duration = 0;

  private beats: number[] = [];
  private currentBeatIndex = 0;
  beatPulseStrength = 0;
  private beatPulseDecay = 0.95;
  private lastBeatTime = -1;
  private beatCooldown = 0.15;

  pitchAnalysisData: PitchData[] = [];
  spectralFeaturesData: SpectralFeature[] = [];

  // Translation parameters
  private maxRadius = 5;
  private spherePosition = new THREE.Vector2(0, 0);
  private targetPosition = new THREE.Vector2(0, 0);
  private positionLerpSpeed = 0.1;

  // Low-pass filter for spectral features
  private smoothedCentroid = 0;
  private smoothedRolloff = 0;
  private smoothingFactor = 0.3;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAnalysisData();
  }

  ngAfterViewInit(): void {
    this.initThreeJS();
    this.createScene();
    this.initAudio();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.sound) {
      this.sound.unload();
    }
  }

  private async loadAnalysisData(): Promise<void> {
    try {
      const data = await lastValueFrom(
        this.http.get<AnalysisData>(`assets/analyses/${this.analysisId}.json`)
      );
      if (data) {
        this.pitchAnalysisData = data.pitch_analysis;
        this.beats = data.temporal_features.beats;
        this.spectralFeaturesData = data.temporal_features.spectral_features;

        // Initialize smoothed values
        if (this.spectralFeaturesData.length > 0) {
          this.smoothedCentroid =
            this.spectralFeaturesData[0].spectral_centroid;
          this.smoothedRolloff = this.spectralFeaturesData[0].spectral_rolloff;
        }

        console.log('Loaded analysis data:', this.beats.length, 'beats');
      }
    } catch (error) {
      console.error('Error loading analysis data:', error);
    }
  }

  private initThreeJS(): void {
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f0f0f);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  private createScene(): void {
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: 0x4a90e2,
      shininess: 100,
    });

    this.sphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.sphere);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.3);
    pointLight.position.set(-5, -5, 5);
    this.scene.add(pointLight);
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    if (this.sound && this.sound.playing()) {
      this.currentTime = (this.sound.seek() as number) || 0;
      this.timeUpdate.emit(this.currentTime);
      this.updateVisualizationByTime(this.currentTime);
      this.checkForBeat(this.currentTime);
    }

    this.beatPulseStrength *= this.beatPulseDecay;

    // Smoothly interpolate sphere position
    this.spherePosition.lerp(this.targetPosition, this.positionLerpSpeed);
    this.sphere.position.x = this.spherePosition.x;
    this.sphere.position.y = this.spherePosition.y;

    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private initAudio(): void {
    const audioPath = `assets/audio/${this.analysisId}.mp3`;

    this.sound = new Howl({
      src: [audioPath],
      html5: true,
      onload: () => {
        this.duration = this.sound.duration();
        this.durationLoaded.emit(this.duration);
      },
      onloaderror: (id, error) => {
        console.error('Error loading audio:', error);
      },
      onplay: () => {
        this.playStateChange.emit(true);
      },
      onpause: () => {
        this.playStateChange.emit(false);
      },
      onend: () => {
        this.playStateChange.emit(false);
        this.currentTime = 0;
      },
    });
  }

  private checkForBeat(currentTime: number): void {
    const lookAheadWindow = 0.05;

    while (this.currentBeatIndex < this.beats.length) {
      const beatTime = this.beats[this.currentBeatIndex];

      if (
        beatTime <= currentTime &&
        beatTime >= currentTime - lookAheadWindow
      ) {
        if (currentTime - this.lastBeatTime >= this.beatCooldown) {
          this.triggerBeatPulse();
          this.updateSpherePosition(currentTime);
          this.lastBeatTime = currentTime;
        }
        this.currentBeatIndex++;
      } else if (beatTime > currentTime) {
        break;
      } else {
        this.currentBeatIndex++;
      }
    }
  }

  private updateSpherePosition(currentTime: number): void {
    const spectralData = this.getSpectralFeatureAtTime(currentTime);
    if (!spectralData) return;

    // Apply low-pass filter for smoothing
    this.smoothedCentroid =
      this.smoothingFactor * spectralData.spectral_centroid +
      (1 - this.smoothingFactor) * this.smoothedCentroid;
    this.smoothedRolloff =
      this.smoothingFactor * spectralData.spectral_rolloff +
      (1 - this.smoothingFactor) * this.smoothedRolloff;

    // Normalize spectral features to 0-1 range
    const normalizedCentroid = Math.min(this.smoothedCentroid / 5000, 1);
    const normalizedRolloff = Math.min(this.smoothedRolloff / 10000, 1);

    // Convert to angle (0-2π) and distance (0-maxRadius)
    const angle = normalizedCentroid * Math.PI * 2;
    const distance = normalizedRolloff * this.maxRadius;

    // Calculate new position
    const newX = Math.cos(angle) * distance;
    const newY = Math.sin(angle) * distance;
    let newPosition = new THREE.Vector2(newX, newY);

    // Check if new position is outside the circle
    if (newPosition.length() > this.maxRadius) {
      newPosition = this.mirrorPositionAtBoundary(
        this.spherePosition,
        newPosition
      );
    }

    // Set target position for smooth interpolation
    this.targetPosition.copy(newPosition);
  }

  private getSpectralFeatureAtTime(time: number): SpectralFeature | null {
    if (this.spectralFeaturesData.length === 0) return null;

    let closestIndex = 0;
    let closestTimeDiff = Math.abs(this.spectralFeaturesData[0].time - time);

    for (let i = 1; i < this.spectralFeaturesData.length; i++) {
      const timeDiff = Math.abs(this.spectralFeaturesData[i].time - time);
      if (timeDiff < closestTimeDiff) {
        closestTimeDiff = timeDiff;
        closestIndex = i;
      }
    }

    return this.spectralFeaturesData[closestIndex];
  }

  private mirrorPositionAtBoundary(
    currentPos: THREE.Vector2,
    targetPos: THREE.Vector2
  ): THREE.Vector2 {
    // Find intersection point with circle boundary
    const direction = new THREE.Vector2()
      .subVectors(targetPos, currentPos)
      .normalize();

    // Calculate intersection with circle
    const a = direction.dot(direction);
    const b = 2 * currentPos.dot(direction);
    const c = currentPos.dot(currentPos) - this.maxRadius * this.maxRadius;
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
      // No intersection, return normalized target
      return targetPos.normalize().multiplyScalar(this.maxRadius * 0.95);
    }

    const t = (-b + Math.sqrt(discriminant)) / (2 * a);
    const intersectionPoint = new THREE.Vector2()
      .copy(currentPos)
      .add(direction.clone().multiplyScalar(t));

    // Calculate normal at intersection (points toward center)
    const normal = intersectionPoint.clone().normalize().negate();

    // Calculate reflection vector
    const overshoot = new THREE.Vector2().subVectors(
      targetPos,
      intersectionPoint
    );
    const reflectedOvershoot = overshoot.sub(
      normal.clone().multiplyScalar(2 * overshoot.dot(normal))
    );

    // New position is intersection + reflected overshoot
    const mirroredPosition = new THREE.Vector2().addVectors(
      intersectionPoint,
      reflectedOvershoot
    );

    // Ensure we stay within bounds
    if (mirroredPosition.length() > this.maxRadius) {
      mirroredPosition.normalize().multiplyScalar(this.maxRadius * 0.95);
    }

    return mirroredPosition;
  }

  private triggerBeatPulse(): void {
    this.beatPulseStrength = 1.0;

    const material = this.sphere.material as THREE.MeshPhongMaterial;
    const currentColor = material.color.getHSL({ h: 0, s: 0, l: 0 });

    material.color.setHSL(
      currentColor.h,
      Math.min(currentColor.s + 0.15, 1),
      Math.min(currentColor.l + 0.2, 0.85)
    );
  }

  updateVisualizationByTime(currentTime: number): void {
    if (this.pitchAnalysisData.length === 0) return;

    let closestIndex = 0;
    let closestTimeDiff = Math.abs(
      this.pitchAnalysisData[0].time - currentTime
    );

    for (let i = 1; i < this.pitchAnalysisData.length; i++) {
      const timeDiff = Math.abs(this.pitchAnalysisData[i].time - currentTime);
      if (timeDiff < closestTimeDiff) {
        closestTimeDiff = timeDiff;
        closestIndex = i;
      }
    }

    this.updateVisualization(closestIndex);
  }

  private updateVisualization(timeIndex: number): void {
    if (timeIndex < this.pitchAnalysisData.length) {
      const currentData = this.pitchAnalysisData[timeIndex];

      if (
        currentData.dominant_pitches &&
        currentData.dominant_pitches.length > 0
      ) {
        const dominantStrength = currentData.dominant_pitches[0].strength;
        const hue = dominantStrength * 360;
        const saturation = 70;
        const lightness = 50 + dominantStrength * 30;

        const material = this.sphere.material as THREE.MeshPhongMaterial;
        material.color.setHSL(hue / 360, saturation / 100, lightness / 100);
      }

      const baseScale = 1;
      const pulseScale = baseScale + this.beatPulseStrength * 0.3;
      this.sphere.scale.setScalar(pulseScale);
    }
  }

  seekTo(time: number): void {
    this.currentTime = time;
    if (this.sound) {
      this.sound.seek(time);
    }

    this.currentBeatIndex = this.beats.findIndex((beat) => beat >= time);
    if (this.currentBeatIndex === -1) {
      this.currentBeatIndex = this.beats.length;
    }

    this.lastBeatTime = time - this.beatCooldown;
    this.updateVisualizationByTime(time);

    // Update position immediately when seeking
    this.updateSpherePosition(time);
    this.spherePosition.copy(this.targetPosition);
  }
}
