import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { type BreadcrumbItem, SeoService } from '../../../application/services/seo.service';

/**
 * Breadcrumbs component for SEO and navigation.
 * Renders visual breadcrumbs based on the current route.
 *
 * @example
 * ```html
 * <app-breadcrumbs [route]="'/ektaron/divinites/tenebra'" />
 * ```
 */
@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './breadcrumbs.component.html',
  styleUrls: ['./breadcrumbs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbsComponent {
  private readonly seoService = inject(SeoService);

  /** Current route path (e.g., '/ektaron/divinites/tenebra') */
  route = input.required<string>();

  /** Computed breadcrumb items from route */
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    return this.seoService.getBreadcrumbs(this.route());
  });
}
