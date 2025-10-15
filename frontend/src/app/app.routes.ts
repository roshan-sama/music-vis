import { Routes } from '@angular/router';
import { AnalysisSmartComponent } from './analysis-smart/analysis-smart.component';

export const routes: Routes = [
  {
    path: 'keypoint-overlay',
    loadComponent: () =>
      import(
        './keypoint-analysis-presentation/keypoint-analysis-presentation.component'
      ).then((m) => m.KeypointAnalysisPresentationComponent),
  },
  {
    path: '',
    redirectTo: '/keypoint-overlay',
    pathMatch: 'full',
  },
  {
    path: 'analysis/:id',
    component: AnalysisSmartComponent,
  },
  {
    path: '3d-vis',
    loadComponent: () =>
      import('./3d-vis/smpl-motion-viewer.component').then(
        (m) => m.SmplMotionViewerComponent
      ),
  },
];
