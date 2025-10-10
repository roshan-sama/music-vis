// app.component.ts (Refactored as Analysis List)
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Analysis {
  id: string;
  title: string;
  description: string;
  artist?: string;
  track?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="analysis-list-container">
      <header class="header">
        <h1>Analysis Dashboard</h1>
        <p>Select an analysis to view synchronized audio and video visualization</p>
      </header>

      <div class="analysis-grid">
        <div 
          *ngFor="let analysis of analyses" 
          class="analysis-card"
          [routerLink]="['/analysis', analysis.id]">
          <div class="card-content">
            <h3>{{ analysis.title }}</h3>
            <p class="description">{{ analysis.description }}</p>
            <div class="metadata" *ngIf="analysis.artist && analysis.track">
              <span class="artist">{{ analysis.artist }}</span>
              <span class="separator">•</span>
              <span class="track">{{ analysis.track }}</span>
            </div>
          </div>
          <div class="card-footer">
            <span class="view-link">View Analysis →</span>
          </div>
        </div>
      </div>
      <router-outlet></router-outlet>
    </div>
  `,
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  analyses: Analysis[] = [
    {
      id: 'power-up',
      title: 'Power Up - Dance Visualization',
      description: 'Synchronized audio pitch analysis and dance keypoint visualization',
      artist: 'Power Up',
      track: 'Dance Visualization'
    }
    // Add more analyses here as they become available
  ];
}