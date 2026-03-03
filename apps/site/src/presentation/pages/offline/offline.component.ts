import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import {
  OfflineDetectionService,
  VisitedPageMeta,
  VisitedPagesService,
} from '../../../infrastructure/offline';

/**
 * Offline fallback page shown when user is offline and content is unavailable.
 *
 * Features:
 * - Displays clear offline status message
 * - Lists recently visited pages (available from cache)
 * - Provides navigation to cached content
 * - Auto-redirects when back online (optional)
 */
@Component({
  selector: 'app-offline',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './offline.component.html',
  styleUrl: './offline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflineComponent implements OnInit {
  private readonly offlineService = inject(OfflineDetectionService);
  private readonly visitedPagesService = inject(VisitedPagesService);

  readonly visitedPages = signal<VisitedPageMeta[]>([]);
  readonly isOnline = signal(false);

  ngOnInit(): void {
    // Load visited pages
    this.visitedPages.set(this.visitedPagesService.getRecentlyVisited(15));

    // Track online status
    this.offlineService.online$.subscribe((online) => {
      this.isOnline.set(online);
    });
  }

  retry(): void {
    window.location.reload();
  }

  formatDate(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  }
}
