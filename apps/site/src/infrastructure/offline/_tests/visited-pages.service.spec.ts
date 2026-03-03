import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { VisitedPagesService } from '../visited-pages.service';

describe('VisitedPagesService', () => {
  describe('Browser Platform', () => {
    let service: VisitedPagesService;
    let mockLocalStorage: { [key: string]: string };

    beforeEach(() => {
      mockLocalStorage = {};

      // Mock localStorage
      const localStorageMock = {
        getItem: jest.fn((key: string) => mockLocalStorage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
        clear: jest.fn(() => {
          mockLocalStorage = {};
        }),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock });

      TestBed.configureTestingModule({
        providers: [VisitedPagesService, { provide: PLATFORM_ID, useValue: 'browser' }],
      });

      service = TestBed.inject(VisitedPagesService);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should start with no visited pages', () => {
      expect(service.visitedCount).toBe(0);
      expect(service.getRecentlyVisited()).toEqual([]);
    });

    it('should record a page visit', () => {
      service.recordVisit('getting-started', 'Getting Started', '/getting-started');

      expect(service.visitedCount).toBe(1);
      const pages = service.getRecentlyVisited();
      expect(pages[0].slug).toBe('getting-started');
      expect(pages[0].title).toBe('Getting Started');
      expect(pages[0].url).toBe('/getting-started');
    });

    it('should update timestamp when revisiting a page', () => {
      service.recordVisit('page1', 'Page 1', '/page1');

      // Wait a bit to ensure timestamp difference
      const firstVisit = service.getRecentlyVisited()[0].lastVisited;

      // Record another visit
      service.recordVisit('page1', 'Page 1 Updated', '/page1');

      const pages = service.getRecentlyVisited();
      expect(pages.length).toBe(1);
      expect(pages[0].title).toBe('Page 1 Updated');
      expect(new Date(pages[0].lastVisited).getTime()).toBeGreaterThanOrEqual(
        new Date(firstVisit).getTime()
      );
    });

    it('should sort pages by most recent first', async () => {
      // Add small delays to ensure distinct timestamps
      service.recordVisit('page1', 'Page 1', '/page1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      service.recordVisit('page2', 'Page 2', '/page2');
      await new Promise((resolve) => setTimeout(resolve, 10));
      service.recordVisit('page3', 'Page 3', '/page3');

      const pages = service.getRecentlyVisited();
      expect(pages[0].slug).toBe('page3');
      expect(pages[1].slug).toBe('page2');
      expect(pages[2].slug).toBe('page1');
    });

    it('should limit results when specified', () => {
      service.recordVisit('page1', 'Page 1', '/page1');
      service.recordVisit('page2', 'Page 2', '/page2');
      service.recordVisit('page3', 'Page 3', '/page3');

      const pages = service.getRecentlyVisited(2);
      expect(pages.length).toBe(2);
    });

    it('should check if a page has been visited', () => {
      service.recordVisit('visited-page', 'Visited', '/visited-page');

      expect(service.hasVisited('visited-page')).toBe(true);
      expect(service.hasVisited('not-visited')).toBe(false);
    });

    it('should get metadata for a visited page', () => {
      service.recordVisit('my-page', 'My Page', '/my-page');

      const page = service.getVisitedPage('my-page');
      expect(page).not.toBeNull();
      expect(page?.title).toBe('My Page');

      const notFound = service.getVisitedPage('unknown');
      expect(notFound).toBeNull();
    });

    it('should clear history', () => {
      service.recordVisit('page1', 'Page 1', '/page1');
      service.recordVisit('page2', 'Page 2', '/page2');

      expect(service.visitedCount).toBe(2);

      service.clearHistory();

      expect(service.visitedCount).toBe(0);
    });

    it('should persist to localStorage', () => {
      service.recordVisit('persisted-page', 'Persisted', '/persisted-page');

      const stored = JSON.parse(mockLocalStorage['vps-visited-pages']);
      expect(stored).toHaveLength(1);
      expect(stored[0].slug).toBe('persisted-page');
    });

    it('should load from localStorage', () => {
      // Pre-populate localStorage
      mockLocalStorage['vps-visited-pages'] = JSON.stringify([
        {
          slug: 'loaded-page',
          title: 'Loaded Page',
          lastVisited: new Date().toISOString(),
          url: '/loaded-page',
        },
      ]);

      // Create new service instance
      const newService = TestBed.inject(VisitedPagesService);

      expect(newService.hasVisited('loaded-page')).toBe(true);
    });

    it('should handle malformed localStorage data gracefully', () => {
      mockLocalStorage['vps-visited-pages'] = 'invalid json';

      const newService = TestBed.inject(VisitedPagesService);

      expect(newService.visitedCount).toBe(0);
    });

    it('should limit to MAX_PAGES (50)', () => {
      // Add more than 50 pages
      for (let i = 0; i < 60; i++) {
        service.recordVisit(`page-${i}`, `Page ${i}`, `/page-${i}`);
      }

      expect(service.visitedCount).toBe(50);
    });
  });

  describe('Server Platform', () => {
    let service: VisitedPagesService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [VisitedPagesService, { provide: PLATFORM_ID, useValue: 'server' }],
      });

      service = TestBed.inject(VisitedPagesService);
    });

    it('should be created on server', () => {
      expect(service).toBeTruthy();
    });

    it('should return empty array on server', () => {
      expect(service.getRecentlyVisited()).toEqual([]);
    });

    it('should return 0 count on server', () => {
      expect(service.visitedCount).toBe(0);
    });

    it('should not throw when recording visit on server', () => {
      expect(() => service.recordVisit('page', 'Page', '/page')).not.toThrow();
    });

    it('should return false for hasVisited on server', () => {
      expect(service.hasVisited('any-page')).toBe(false);
    });

    it('should return null for getVisitedPage on server', () => {
      expect(service.getVisitedPage('any-page')).toBeNull();
    });
  });
});
