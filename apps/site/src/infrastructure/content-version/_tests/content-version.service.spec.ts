import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ContentVersionService } from '../content-version.service';

describe('ContentVersionService', () => {
  describe('Browser Platform', () => {
    let service: ContentVersionService;
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

      // Mock EventSource
      const mockEventSource = jest.fn(() => ({
        onopen: null,
        onmessage: null,
        onerror: null,
        close: jest.fn(),
      }));
      Object.defineProperty(window, 'EventSource', { value: mockEventSource, writable: true });

      TestBed.configureTestingModule({
        providers: [ContentVersionService, { provide: PLATFORM_ID, useValue: 'browser' }],
      });

      service = TestBed.inject(ContentVersionService);
    });

    afterEach(() => {
      service.ngOnDestroy();
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should start with empty version', () => {
      expect(service.currentVersion).toBe('');
    });

    it('should load persisted version from localStorage', () => {
      // Set a version before checking (in the same test, service is singleton)
      mockLocalStorage['vps-content-version'] = 'test-version-123';

      // Manually trigger load since the service was already created
      service['loadPersistedVersion']();

      expect(service.currentVersion).toBe('test-version-123');
    });

    it('should emit version through contentVersion$ observable', (done) => {
      service.setVersion('new-version');

      service.contentVersion$.subscribe((version) => {
        if (version === 'new-version') {
          done();
        }
      });
    });

    it('should persist version to localStorage when set', () => {
      service.setVersion('persisted-version');

      expect(mockLocalStorage['vps-content-version']).toBe('persisted-version');
    });

    it('should emit on versionChanged$ when version changes', (done) => {
      // Set initial version
      service.setVersion('v1');

      // Subscribe to changes
      service.versionChanged$.subscribe((info) => {
        expect(info.version).toBe('v2');
        expect(info.generatedAt).toBeDefined();
        done();
      });

      // Change version
      service.setVersion('v2');
    });

    it('should not emit versionChanged$ for initial version', () => {
      const versionChangedSpy = jest.fn();
      service.versionChanged$.subscribe(versionChangedSpy);

      // Set first version
      service.setVersion('v1');

      // No emission expected for first version (no previous version to compare)
      // But since we're setting from empty string, it should emit
      expect(versionChangedSpy).not.toHaveBeenCalled();
    });
  });

  describe('Server Platform', () => {
    let service: ContentVersionService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [ContentVersionService, { provide: PLATFORM_ID, useValue: 'server' }],
      });

      service = TestBed.inject(ContentVersionService);
    });

    afterEach(() => {
      service.ngOnDestroy();
    });

    it('should be created on server', () => {
      expect(service).toBeTruthy();
    });

    it('should have empty version on server', () => {
      expect(service.currentVersion).toBe('');
    });

    it('should not throw when setVersion is called on server', () => {
      expect(() => service.setVersion('test')).not.toThrow();
    });

    it('should return null from checkVersion on server', async () => {
      const result = await service.checkVersion();
      expect(result).toBeNull();
    });
  });
});
