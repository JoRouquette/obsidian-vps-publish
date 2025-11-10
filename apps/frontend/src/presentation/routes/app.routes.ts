import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { ShellComponent } from '../shell/shell.component';
import { HomeComponent } from '../pages/home/home.component';
import { ViewerComponent } from '../pages/viewer/viewer.component';

export function pageMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length && segments[0].path === 'p') {
    const slug = segments
      .slice(1)
      .map((s) => s.path)
      .join('/');
    return { consumed: segments, posParams: { slug: new UrlSegment(slug, {}) } };
  }
  return null;
}

export const APP_ROUTES: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', component: HomeComponent },
      { matcher: pageMatcher, component: ViewerComponent },
      { path: '**', redirectTo: '' },
    ],
  },
];
