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
import { notes, PitchData } from '../interfaces/pitch-analysis-data';
import { updateVisualization } from '../utils/audio-analysis';

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
    onsets: number[];
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
  private gridHelper!: THREE.GridHelper;

  private sound!: Howl;
  currentTime = 0;
  duration = 0;

  private beats: number[] = [];
  private onsets: number[] = [];
  private currentBeatIndex = 0;
  beatPulseStrength = 0;
  private beatPulseDecay = 0.95;
  private lastBeatTime = -1;
  private beatCooldown = 0.15;
  private beatCounter = 0;

  pitchAnalysisData: PitchData[] = [];
  spectralFeaturesData: SpectralFeature[] = [];

  // Translation parameters
  private maxRadius = 3;
  private spherePosition = new THREE.Vector2(0, 0);
  private targetPosition = new THREE.Vector2(0, 0);
  private positionLerpSpeed = 0.1;

  // Low-pass filter for spectral features
  private smoothedCentroid = 0;
  private smoothedRolloff = 0;
  private smoothingFactor = 0.3;

  // Velocity-based properties
  private currentPosition: THREE.Vector2 = new THREE.Vector2(0, 0);
  private previousPosition: THREE.Vector2 = new THREE.Vector2(0, 0);
  private currentVelocity: THREE.Vector2 = new THREE.Vector2(0, 0);
  private originalVelocity: THREE.Vector2 = new THREE.Vector2(0, 0);
  private lastTwoBeats: number[] = [];
  private rmsWindowStart: number = 0;
  private lastFrameTime: number = 0;

  // Velocity physics constants
  private velocityScale: number = 1.0; // Scale factor for velocity magnitude
  private accelerationScale: number = 1; // Scale for RMS-based acceleration
  private returnAcceleration: number = 3; // Acceleration toward original velocity
  private minVelocityThreshold: number = 0.005;
  private maxVelocityThreshold: number = 5;
  private maxRmsWindow: number = 4.0; // 4 seconds max
  private onsetBoostFactor = 1.05;
  private dominantPitchStrengthMin = 0.7;
  private otherPitchStrengthMax = 0.5;

  /**Fire force
   * private velocityScale: number = 1.32; // Scale factor for velocity magnitude
  private accelerationScale: number = 0.8; // Scale for RMS-based acceleration
  private returnAcceleration: number = 0.2; // Acceleration toward original velocity
  private minVelocityThreshold: number = 0.01;
  private maxRmsWindow: number = 8.0; // 4 seconds max
  private onsetBoostFactor = 4; */

  /**Power up
   * private velocityScale: number = 1; // Scale factor for velocity magnitude
  private accelerationScale: number = 0.2; // Scale for RMS-based acceleration
  private returnAcceleration: number = 0.05; // Acceleration toward original velocity
  private minVelocityThreshold: number = 0.01; */

  //Pitch Rings
  private pitchRings: Map<notes, THREE.Mesh> = new Map();
  private readonly noteOrder: notes[] = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ];
  private readonly innerRadius = 0.5;
  private readonly outerRadiusMax = 1.0;

  private cameraError: THREE.Vector2 = new THREE.Vector2(0, 0);
  private accumulatedError: THREE.Vector2 = new THREE.Vector2(0, 0);
  private readonly cameraKp = 5.0; // Proportional gain - adjust for responsiveness
  private readonly cameraKi = 0.5; // Integral gain - adjust to eliminate steady-state error

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
    this.pitchRings.forEach((mesh) => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.scene.remove(mesh);
    });
    this.pitchRings.clear();
    this.gridHelper.geometry.dispose();
    (this.gridHelper.material as THREE.Material).dispose();
    this.scene.remove(this.gridHelper);
  }

  private async loadAnalysisData(): Promise<void> {
    try {
      const data = await lastValueFrom(
        this.http.get<AnalysisData>(`assets/analyses/${this.analysisId}.json`)
      );
      if (data) {
        this.pitchAnalysisData = data.pitch_analysis;
        this.beats = data.temporal_features.beats;
        this.onsets = data.temporal_features.onsets;
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
    const width = 1600;
    const height = 800;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xff8c42); // Orange background

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Create infinite grid
    this.createInfiniteGrid();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  private createInfiniteGrid(): void {
    const size = 100; // Large grid size
    const divisions = 100; // Number of divisions

    this.gridHelper = new THREE.GridHelper(size, divisions, 0x8b4513, 0x8b4513); // Brown color

    // Rotate grid to XY plane (perpendicular to camera view)
    this.gridHelper.rotation.x = Math.PI / 2;

    // Position grid slightly behind everything
    this.gridHelper.position.z = -0.5;

    this.scene.add(this.gridHelper);
  }

  private createScene(): void {
    const geometry = new THREE.SphereGeometry(0.4, 32, 32);
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
    this.createPitchRings();
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    if (this.sound && this.sound.playing()) {
      this.currentTime = (this.sound.seek() as number) || 0;
      this.timeUpdate.emit(this.currentTime);

      // Calculate deltaTime for physics
      const now = performance.now() / 1000; // Convert to seconds
      const deltaTime = this.lastFrameTime > 0 ? now - this.lastFrameTime : 0;
      this.lastFrameTime = now;

      // Update color and scale based on pitch data
      this.updateVisualizationByTime(this.currentTime);

      // Check for beats and update target position
      this.checkForBeat(this.currentTime);

      // Check for dominant pitch direction (before updateVelocity)
      const dominantDirection = this.getDominantPitchDirection(
        this.currentTime
      );

      // Update velocity based on RMS energy
      this.updateVelocity(this.currentTime, dominantDirection);

      // Apply velocity to position
      if (deltaTime > 0) {
        const velocityDelta = this.currentVelocity
          .clone()
          .multiplyScalar(deltaTime);
        this.spherePosition.add(velocityDelta);

        // Ensure position stays within bounds
        if (this.spherePosition.length() >= this.maxRadius * 0.95) {
          this.spherePosition.set(0, 0);
        }
      }

      // Update sphere mesh position
      this.sphere.position.x = this.spherePosition.x;
      this.sphere.position.y = this.spherePosition.y;

      // Make camera follow sphere position
      // Update camera with PI control and point at sphere
      this.updateCameraPosition(deltaTime);
    }

    this.beatPulseStrength *= this.beatPulseDecay;

    // Update pitch ring segments
    this.updatePitchRings(this.currentTime);

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
          this.beatCounter++;

          // Track last two beats for RMS window
          this.lastTwoBeats.push(currentTime);
          if (this.lastTwoBeats.length > 2) {
            this.lastTwoBeats.shift();
          }

          // Update RMS window start
          if (this.lastTwoBeats.length >= 2) {
            this.rmsWindowStart = this.lastTwoBeats[0];
          } else {
            this.rmsWindowStart = currentTime;
          }

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

  private getOnsetStrengthAtTime(currentTime: number): number {
    // Find nearest onset within a small time window (e.g., 50ms)
    const tolerance = 0.05; // 50ms
    const nearestOnset = this.onsets.find(
      (onset) => Math.abs(onset - currentTime) < tolerance
    );

    if (nearestOnset) {
      // Return strength that decays quickly after the onset
      const timeSinceOnset = currentTime - nearestOnset;
      const decay = Math.exp(-timeSinceOnset * 20); // Fast decay
      return decay;
    }

    return 0;
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
    const baseAngle = normalizedCentroid * Math.PI * 2;
    const rotationOffset = ((this.beatCounter % 2) * Math.PI) / 4;
    const angle = baseAngle + rotationOffset;
    const distance = normalizedRolloff * (this.maxRadius - 2);

    // Calculate new position
    const newX = Math.cos(angle) * distance;
    const newY = Math.sin(angle) * distance;
    let newPosition = new THREE.Vector2(newX, newY);

    // Check if new position is outside the circle
    if (newPosition.length() > this.maxRadius) {
      newPosition = new THREE.Vector2(0, 0);
    }

    // Store previous position
    this.previousPosition.copy(this.currentPosition);

    // Calculate movement vector from old to new position
    const movementVector = new THREE.Vector2().subVectors(
      newPosition,
      this.previousPosition
    );

    // Set original velocity proportional to movement distance
    const movementMagnitude = movementVector.length();
    if (movementMagnitude > 0.01) {
      this.originalVelocity
        .copy(movementVector)
        .multiplyScalar(this.velocityScale);
      this.currentVelocity.copy(this.originalVelocity);
    }

    // Set current position to new beat position
    this.currentPosition.copy(newPosition);
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

  private getWindowedAverageRMS(currentTime: number): number {
    // Calculate window size
    let windowStart = this.rmsWindowStart;
    let windowDuration = currentTime - windowStart;

    // If we're waiting for a beat and window is growing
    if (this.lastTwoBeats.length >= 2) {
      const expectedBeatInterval = this.lastTwoBeats[1] - this.lastTwoBeats[0];
      const timeSinceLastBeat = currentTime - this.lastBeatTime;

      // If we've exceeded expected beat time, grow the window
      if (timeSinceLastBeat > expectedBeatInterval) {
        windowDuration = Math.min(windowDuration, this.maxRmsWindow);
      }
    } else {
      // No beat pattern yet, use max window
      windowDuration = Math.min(windowDuration, this.maxRmsWindow);
    }

    // Calculate average RMS over window
    const spectralFeatures = this.spectralFeaturesData;
    let sum = 0;
    let count = 0;

    for (const feature of spectralFeatures) {
      if (feature.time >= windowStart && feature.time <= currentTime) {
        sum += feature.rms_energy;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  private updateVelocity(
    currentTime: number,
    dominantDirection: THREE.Vector2 | null
  ): void {
    const spectralData = this.getSpectralFeatureAtTime(currentTime);
    if (!spectralData) return;

    const onsetStrength = this.getOnsetStrengthAtTime(currentTime);

    const averageRMS = this.getWindowedAverageRMS(currentTime);
    const currentRMS = spectralData.rms_energy;
    const rmsDifference = currentRMS - averageRMS;

    // Normalize the difference by average RMS
    const normalizedDifference =
      averageRMS > 0 ? rmsDifference / averageRMS : 0;

    // Check if difference is miniscule (less than 10% of averaged RMS)
    const isMiniscule = Math.abs(normalizedDifference) < 0.1;

    const onsetMultiplier = 1.0 + onsetStrength * this.onsetBoostFactor;

    // Hard direction change if dominant pitch exists
    if (dominantDirection) {
      const currentSpeed = this.currentVelocity.length();
      this.currentVelocity.copy(dominantDirection).multiplyScalar(currentSpeed);
    }

    if (isMiniscule) {
      // Apply small acceleration toward original velocity
      const velocityDiff = new THREE.Vector2().subVectors(
        this.originalVelocity,
        this.currentVelocity
      );

      // Only apply if velocity is not already close to original
      if (velocityDiff.length() > 0.01) {
        const returnAccel = velocityDiff
          .normalize()
          .multiplyScalar(this.returnAcceleration);
        this.currentVelocity.add(returnAccel);
      }
    } else {
      // Apply acceleration based on RMS difference
      if (this.currentVelocity.length() > 0) {
        const velocityDirection = this.currentVelocity.clone().normalize();
        const acceleration = velocityDirection.multiplyScalar(
          normalizedDifference * this.accelerationScale * onsetMultiplier
        );

        this.currentVelocity.add(acceleration);
      }
    }

    // Clamp velocity to minimum threshold
    if (this.currentVelocity.length() <= this.minVelocityThreshold) {
      this.currentVelocity.set(0, 0);
    }

    if (this.currentVelocity.length() >= this.maxVelocityThreshold) {
      this.currentVelocity
        .normalize()
        .multiplyScalar(this.maxVelocityThreshold);
    }
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
    if (this.pitchAnalysisData.length === 0) {
      return;
    }

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

    updateVisualization(
      closestIndex,
      this.pitchAnalysisData,
      this.beatPulseStrength,
      this.sphere
    );
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

  // Pitch Rings
  private createPitchRings(): void {
    const segmentAngle = (Math.PI * 2) / 12; // 360° / 12 notes
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });

    this.noteOrder.forEach((note, index) => {
      const thetaStart = index * segmentAngle;
      const geometry = new THREE.RingGeometry(
        this.innerRadius,
        this.innerRadius, // Start with minimum size
        32,
        1,
        thetaStart,
        segmentAngle
      );

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = -0.1; // Slightly behind sphere
      this.scene.add(mesh);
      this.pitchRings.set(note, mesh);
    });
  }

  private updatePitchRings(currentTime: number): void {
    const pitchData = this.getPitchDataAtTime(currentTime);
    if (!pitchData) return;

    const segmentAngle = (Math.PI * 2) / 12;
    const minCutoff = 0.5;
    const maxCutoff = 0.7;

    this.noteOrder.forEach((note, index) => {
      const mesh = this.pitchRings.get(note);
      if (!mesh) return;

      const rawStrength = pitchData.all_pitches[note];

      // Apply linear interpolation with cutoffs
      let scaledStrength: number;
      if (rawStrength <= minCutoff) {
        scaledStrength = 0;
      } else if (rawStrength >= maxCutoff) {
        scaledStrength = 1;
      } else {
        // Linear interpolation between minCutoff and maxCutoff
        scaledStrength = (rawStrength - minCutoff) / (maxCutoff - minCutoff);
      }

      // Outer radius varies from innerRadius to outerRadiusMax based on scaled strength
      const outerRadius =
        this.innerRadius +
        scaledStrength * (this.outerRadiusMax - this.innerRadius);

      // Recreate geometry with new outer radius
      const thetaStart = index * segmentAngle;
      const newGeometry = new THREE.RingGeometry(
        this.innerRadius,
        outerRadius,
        32,
        1,
        thetaStart,
        segmentAngle
      );

      // Dispose old geometry and update
      mesh.geometry.dispose();
      mesh.geometry = newGeometry;

      // Position rings at sphere's current position
      mesh.position.x = this.spherePosition.x;
      mesh.position.y = this.spherePosition.y;
    });
  }

  private getPitchDataAtTime(time: number): PitchData | null {
    if (!this.pitchAnalysisData || this.pitchAnalysisData.length === 0)
      return null;

    // Find closest pitch data point
    let closest = this.pitchAnalysisData[0];
    let minDiff = Math.abs(this.pitchAnalysisData[0].time - time);

    for (const data of this.pitchAnalysisData) {
      const diff = Math.abs(data.time - time);
      if (diff < minDiff) {
        minDiff = diff;
        closest = data;
      }
    }

    return closest;
  }

  private getDominantPitchDirection(currentTime: number): THREE.Vector2 | null {
    const pitchData = this.getPitchDataAtTime(currentTime);
    if (!pitchData) return null;

    let dominantNote: notes | null = null;
    let dominantStrength = 0;

    // Find pitch above threshold
    for (const note of this.noteOrder) {
      const strength = pitchData.all_pitches[note];
      if (
        strength >= this.dominantPitchStrengthMin &&
        strength > dominantStrength
      ) {
        dominantNote = note;
        dominantStrength = strength;
      }
    }

    // If no dominant pitch found, return null
    if (!dominantNote) return null;

    // Check that all other pitches are below max threshold
    for (const note of this.noteOrder) {
      if (note === dominantNote) continue;
      if (pitchData.all_pitches[note] > this.otherPitchStrengthMax) {
        return null; // Multiple strong pitches, no single dominant
      }
    }

    // Calculate direction based on pitch position in ring
    const noteIndex = this.noteOrder.indexOf(dominantNote);
    const segmentAngle = (Math.PI * 2) / 12;
    const pitchAngle = noteIndex * segmentAngle + segmentAngle / 2; // Center of segment

    // Convert angle to direction vector
    const direction = new THREE.Vector2(
      Math.cos(pitchAngle),
      Math.sin(pitchAngle)
    );

    return direction.normalize();
  }

  private updateCameraPosition(deltaTime: number): void {
    // Calculate error (where sphere is vs where camera is)
    this.cameraError.set(
      this.spherePosition.x - this.camera.position.x,
      this.spherePosition.y - this.camera.position.y
    );

    // Accumulate error for integral term
    this.accumulatedError.x += this.cameraError.x * deltaTime;
    this.accumulatedError.y += this.cameraError.y * deltaTime;

    // PI control: P term + I term
    const correctionX =
      this.cameraKp * this.cameraError.x +
      this.cameraKi * this.accumulatedError.x;

    const correctionY =
      this.cameraKp * this.cameraError.y +
      this.cameraKi * this.accumulatedError.y;

    // Apply correction
    this.camera.position.x += correctionX * deltaTime;
    this.camera.position.y += correctionY * deltaTime;

    // Always point camera at sphere (snap rotation)
    this.camera.lookAt(
      this.spherePosition.x,
      this.spherePosition.y,
      this.sphere.position.z
    );
  }
}
