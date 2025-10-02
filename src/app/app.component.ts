import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import * as THREE from 'three';
import { Howl } from 'howler';
import { data } from './analyses/Zaz - Champs Elysees';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('threeCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private sphere!: THREE.Mesh;
  private animationId!: number;

  // Audio player properties
  private sound!: Howl;
  isPlaying = false;
  currentTime = 0;
  duration = 0;
  isDragging = false;
  
  // Audio file path - replace with your .mp3 file path
  private audioPath = '/assets/audio/ZAZ - Champs Elysees.mp3';

  // Sample pitch analysis data structure
  pitchAnalysisData = data.pitch_analysis

  ngOnInit(): void {
    // Component initialization
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

  private initThreeJS(): void {
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f0f0f);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 5);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: canvas,
      antialias: true 
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private createScene(): void {
    // Create a sphere geometry
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    
    // Create a material with a nice color
    const material = new THREE.MeshPhongMaterial({ 
      color: 0x4a90e2,
      shininess: 100
    });
    
    // Create the sphere mesh
    this.sphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.sphere);

    // Add lighting
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

    // Update current time if playing and not dragging
    if (this.isPlaying && !this.isDragging && this.sound) {
      this.currentTime = this.sound.seek() as number || 0;
      this.updateVisualizationByTime(this.currentTime);
    }

    // Rotate the sphere for visual interest
    this.sphere.rotation.x += 0.01;
    this.sphere.rotation.y += 0.01;

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

  // Audio initialization and control methods
  private initAudio(): void {
    this.sound = new Howl({
      src: [this.audioPath],
      html5: true, // Use HTML5 Audio for better control
      onload: () => {
        this.duration = this.sound.duration();
        console.log('Audio loaded, duration:', this.duration);
      },
      onloaderror: (id, error) => {
        console.error('Error loading audio:', error);
        // Fallback: create a dummy duration for development
        this.duration = 180; // 3 minutes fallback
      },
      onplay: () => {
        this.isPlaying = true;
      },
      onpause: () => {
        this.isPlaying = false;
      },
      onend: () => {
        this.isPlaying = false;
        this.currentTime = 0;
      }
    });
  }

  togglePlayPause(): void {
    if (this.sound.playing()) {
      this.sound.pause();
    } else {
      this.sound.play();
    }
  }

  onSliderStart(): void {
    this.isDragging = true;
  }

  onSliderChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.currentTime = parseFloat(target.value);
    
    if (this.sound) {
      this.sound.seek(this.currentTime);
    }
    
    // Update visualization based on current time
    this.updateVisualizationByTime(this.currentTime);
  }

  onSliderEnd(): void {
    this.isDragging = false;
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  get progressPercentage(): number {
    return this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
  }

  updateVisualizationByTime(currentTime: number): void {
    // Find the closest data point based on current time
    let closestIndex = 0;
    let closestTimeDiff = Math.abs(this.pitchAnalysisData[0].time - currentTime);

    for (let i = 1; i < this.pitchAnalysisData.length; i++) {
      const timeDiff = Math.abs(this.pitchAnalysisData[i].time - currentTime);
      if (timeDiff < closestTimeDiff) {
        closestTimeDiff = timeDiff;
        closestIndex = i;
      }
    }

    this.updateVisualization(closestIndex);
  }

  updateVisualization(timeIndex: number): void {
    if (timeIndex < this.pitchAnalysisData.length) {
      const currentData = this.pitchAnalysisData[timeIndex];
      console.log('Current pitch data at time', currentData.time + 's:', currentData);
      
      // Update sphere color based on dominant pitch strength
      if (currentData.dominant_pitches && currentData.dominant_pitches.length > 0) {
        const dominantStrength = currentData.dominant_pitches[0].strength;
        const hue = dominantStrength * 360; // Map strength to hue
        const saturation = 70;
        const lightness = 50 + (dominantStrength * 30); // Brighter with stronger signal
        
        const material = this.sphere.material as THREE.MeshPhongMaterial;
        material.color.setHSL(hue / 360, saturation / 100, lightness / 100);
      }
      
      // Scale sphere based on overall pitch activity
      const avgPitchStrength = Object.values(currentData.all_pitches)
        .reduce((sum, strength) => sum + strength, 0) / 12;
      const scale = 1 + (avgPitchStrength * 2); // Scale from 1 to 3
      this.sphere.scale.setScalar(scale);
      
      // Future: More sophisticated 3D visualization based on pitch strengths
    }
  }
}