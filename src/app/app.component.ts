import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FrequencyAnalysis } from './interfaces/time-data.interface';
import * as THREE from 'three';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {  
  @ViewChild('threeCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  pitchAnalysisData: FrequencyAnalysis[] = [];

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private sphere!: THREE.Mesh;
  private animationId!: number;

  ngAfterViewInit(): void {
    this.initThreeJS();
    this.createScene();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
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

  // Method to update visualization based on pitch data
  // We'll expand this in future iterations
  updateVisualization(timeIndex: number): void {
    if (timeIndex < this.pitchAnalysisData.length) {
      const currentData = this.pitchAnalysisData[timeIndex];
      console.log('Current pitch data:', currentData);
      // Future: Update 3D visualization based on pitch strengths
    }
  }
}
