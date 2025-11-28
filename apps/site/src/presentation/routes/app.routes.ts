import { Routes } from '@angular/router';
import { ShellComponent } from '../shell/shell.component';
import { HomeComponent } from '../pages/home/home.component';
import { ViewerComponent } from '../pages/viewer/viewer.component';

export const APP_ROUTES: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', component: HomeComponent },
      { path: '**', component: ViewerComponent },
    ],
  },
];
