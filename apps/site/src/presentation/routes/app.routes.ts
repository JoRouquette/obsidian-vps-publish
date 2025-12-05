import { type Routes } from '@angular/router';

import { ShellComponent } from '../shell/shell.component';

export const APP_ROUTES: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('../pages/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'search',
        loadComponent: () =>
          import('../pages/search/search-content.component').then((m) => m.SearchContentComponent),
      },
      {
        path: '**',
        loadComponent: () =>
          import('../pages/viewer/viewer.component').then((m) => m.ViewerComponent),
      },
    ],
  },
];
