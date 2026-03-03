import { type Routes } from '@angular/router';

import { seoResolver } from '../../application/resolvers/seo.resolver';
import { ShellComponent } from '../shell/shell.component';

export const APP_ROUTES: Routes = [
  {
    path: 'offline',
    loadComponent: () =>
      import('../pages/offline/offline.component').then((m) => m.OfflineComponent),
  },
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('../pages/home/home.component').then((m) => m.HomeComponent),
        resolve: { seo: seoResolver },
      },
      {
        path: 'search',
        loadComponent: () =>
          import('../pages/search/search-content.component').then((m) => m.SearchContentComponent),
        resolve: { seo: seoResolver },
      },
      {
        path: '**',
        loadComponent: () =>
          import('../pages/viewer/viewer.component').then((m) => m.ViewerComponent),
        resolve: { seo: seoResolver },
      },
    ],
  },
];
