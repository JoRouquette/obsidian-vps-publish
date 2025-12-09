import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';

import { SearchFacade } from '../../../application/facades/search-facade';
import { SearchBarComponent } from '../../components/search-bar/search-bar.component';

type Crumb = { label: string; url: string };

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    SearchBarComponent,
  ],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
})
export class TopbarComponent {
  @Input() siteName = '';
  @Input() crumbs: Crumb[] = [];
  @Input() isDark = false;
  @Input() lastVisited = '/';

  @Output() toggleTheme = new EventEmitter<void>();
  @Output() searchIconClick = new EventEmitter<void>();
  @Output() burgerMenuClick = new EventEmitter<void>();

  constructor(
    private readonly router: Router,
    public search: SearchFacade
  ) {}

  async onQueryInput(value: string): Promise<void> {
    const query = (value ?? '').trim();
    this.search.setQuery(query);
    if (query.length === 0) {
      const target = this.router.url.startsWith('/search')
        ? this.lastVisited || '/'
        : this.router.url;
      await this.router.navigateByUrl(target || '/');
      return;
    }

    if (query.length >= 3) {
      await this.search.ensureIndex();
    }

    await this.router.navigate(['/search'], { queryParams: { q: query } });
  }
}
