import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OfflineDetectionService } from '../offline-detection.service';

describe('OfflineDetectionService', () => {
  describe('Browser Platform', () => {
    let service: OfflineDetectionService;
    let navigatorOnLine: boolean;

    beforeEach(() => {
      navigatorOnLine = true;

      // Mock navigator.onLine
      Object.defineProperty(window.navigator, 'onLine', {
        get: () => navigatorOnLine,
        configurable: true,
      });

      TestBed.configureTestingModule({
        providers: [OfflineDetectionService, { provide: PLATFORM_ID, useValue: 'browser' }],
      });

      service = TestBed.inject(OfflineDetectionService);
    });

    afterEach(() => {
      service.ngOnDestroy();
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initially reflect navigator.onLine state', () => {
      expect(service.isOnline).toBe(true);
      expect(service.isOffline).toBe(false);
    });

    it('should emit online status through online$ observable', (done) => {
      service.online$.subscribe((online) => {
        expect(online).toBe(true);
        done();
      });
    });

    it('should emit offline status through offline$ observable', (done) => {
      service.offline$.subscribe((offline) => {
        expect(offline).toBe(false); // Initially online
        done();
      });
    });

    it('should update when offline event is dispatched', (done) => {
      // Track emissions
      const emissions: boolean[] = [];
      service.online$.subscribe((online) => {
        emissions.push(online);
        if (emissions.length === 2) {
          expect(emissions[1]).toBe(false);
          done();
        }
      });

      // Dispatch offline event
      window.dispatchEvent(new Event('offline'));
    });

    it('should update when online event is dispatched', (done) => {
      // First go offline
      window.dispatchEvent(new Event('offline'));

      // Track emissions after going offline
      setTimeout(() => {
        const emissions: boolean[] = [];
        service.online$.subscribe((online) => {
          emissions.push(online);
          if (online === true && emissions.length > 1) {
            done();
          }
        });

        // Go back online
        window.dispatchEvent(new Event('online'));
      }, 10);
    });
  });

  describe('Server Platform', () => {
    let service: OfflineDetectionService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [OfflineDetectionService, { provide: PLATFORM_ID, useValue: 'server' }],
      });

      service = TestBed.inject(OfflineDetectionService);
    });

    afterEach(() => {
      service.ngOnDestroy();
    });

    it('should be created on server', () => {
      expect(service).toBeTruthy();
    });

    it('should always be online on server', () => {
      expect(service.isOnline).toBe(true);
      expect(service.isOffline).toBe(false);
    });

    it('should emit true from online$ on server', (done) => {
      service.online$.subscribe((online) => {
        expect(online).toBe(true);
        done();
      });
    });
  });
});
