import { Routes } from '@angular/router';

export const routes: Routes = [{
    path: 'keypoint-overlay', loadComponent: () => import('./keypoint-overlay/keypoint-overlay.component').then(m => m.KeypointOverlayComponent)
  },
  {
    path: '',
    redirectTo: '/keypoint-overlay',
    pathMatch: 'full'
  }
];
