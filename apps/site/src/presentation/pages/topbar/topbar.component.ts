import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { CatalogFacade } from '../../../application/facades/catalog-facade';
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

  @Output() toggleTheme = new EventEmitter<void>();

  constructor(public catalog: CatalogFacade) {}

  onQueryInput(value: string) {
    this.catalog.query.set(value ?? '');
  }
}
