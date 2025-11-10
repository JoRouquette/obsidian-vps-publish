import { Component, inject, effect, signal } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss'],
})
export class ViewerComponent {
  private route = inject(ActivatedRoute);
  title = signal<string>('');
  html = signal<SafeHtml>('Chargement…' as any);

  slug: string = '';

  constructor() {
    this.route.paramMap.subscribe((pm) => {
      this.slug = pm.get('slug') ?? '';
    });
  }
}
