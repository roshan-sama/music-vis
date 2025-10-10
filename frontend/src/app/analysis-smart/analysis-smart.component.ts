// analysis-smart.component.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AudioAnalysisPresentationComponent } from '../audio-analysis-presentation/audio-analysis-presentation.component';
import { KeypointAnalysisPresentationComponent } from '../keypoint-analysis-presentation/keypoint-analysis-presentation.component';

@Component({
  selector: 'app-analysis-smart',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    AudioAnalysisPresentationComponent,
    KeypointAnalysisPresentationComponent
  ],
  templateUrl: './analysis-smart.component.html',
  styleUrls: ['./analysis-smart.component.css']
})
export class AnalysisSmartComponent implements OnInit {
  @ViewChild(AudioAnalysisPresentationComponent) audioComponent!: AudioAnalysisPresentationComponent;
  @ViewChild(KeypointAnalysisPresentationComponent) keypointComponent!: KeypointAnalysisPresentationComponent;

  analysisId = '';
  analysisTitle = '';
  
  currentTime = 0;
  duration = 0;
  isPlaying = false;
  isDragging = false;

  // Sync state
  private isAudioMaster = true; // Audio drives the timeline by default

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.analysisId = params['id'];
      this.analysisTitle = this.formatAnalysisTitle(this.analysisId);
    });
  }

  private formatAnalysisTitle(id: string): string {
    // Convert 'zaz-champs-elysees' to 'Zaz - Champs Elysées'
    return id
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  togglePlayPause(): void {
    this.isPlaying = !this.isPlaying;
  }

  onAudioTimeUpdate(time: number): void {
    if (this.isAudioMaster && !this.isDragging) {
      this.currentTime = time;
    }
  }

  onAudioDurationLoaded(duration: number): void {
    this.duration = duration;
  }

  onPlayStateChange(playing: boolean): void {
    this.isPlaying = playing;
  }

  onKeypointFrameChange(time: number): void {
    // Keypoint component reports frame changes if needed
    // Usually audio is master, so we don't sync back
  }

  onKeypointFramesLoaded(totalFrames: number): void {
    console.log('Keypoint frames loaded:', totalFrames);
  }

  onSliderStart(): void {
    this.isDragging = true;
  }

  onSliderEnd(): void {
    this.isDragging = false;
  }

  onSliderChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.currentTime = parseFloat(target.value);
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  get progressPercentage(): number {
    return this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
  }
}