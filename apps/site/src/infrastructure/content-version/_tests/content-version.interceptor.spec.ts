import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { contentVersionInterceptor } from '../content-version.interceptor';
import { ContentVersionService } from '../content-version.service';

describe('contentVersionInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let contentVersionService: ContentVersionService;

  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    // Mock EventSource
    Object.defineProperty(window, 'EventSource', {
      value: jest.fn(() => ({
        onopen: null,
        onmessage: null,
        onerror: null,
        close: jest.fn(),
      })),
      writable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([contentVersionInterceptor])),
        provideHttpClientTesting(),
        ContentVersionService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    contentVersionService = TestBed.inject(ContentVersionService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  describe('when version is set', () => {
    beforeEach(() => {
      contentVersionService.setVersion('test-cv-123');
    });

    it('should add cv parameter to manifest requests', () => {
      httpClient.get('/content/_manifest.json').subscribe();

      const req = httpTestingController.expectOne(
        (request) =>
          request.url.startsWith('/content/_manifest.json') &&
          request.url.includes('cv=test-cv-123')
      );
      expect(req.request.url).toBe('/content/_manifest.json?cv=test-cv-123');
      req.flush({});
    });

    it('should add cv parameter to content page requests', () => {
      httpClient.get('/content/my-page.html').subscribe();

      const req = httpTestingController.expectOne(
        (request) =>
          request.url.startsWith('/content/my-page.html') && request.url.includes('cv=test-cv-123')
      );
      expect(req.request.url).toBe('/content/my-page.html?cv=test-cv-123');
      req.flush('');
    });

    it('should NOT add cv parameter to JS files', () => {
      httpClient.get('/main.js').subscribe();

      const req = httpTestingController.expectOne('/main.js');
      expect(req.request.url).toBe('/main.js');
      req.flush('');
    });

    it('should NOT add cv parameter to CSS files', () => {
      httpClient.get('/styles.css').subscribe();

      const req = httpTestingController.expectOne('/styles.css');
      expect(req.request.url).toBe('/styles.css');
      req.flush('');
    });

    it('should NOT add cv parameter to font files', () => {
      httpClient.get('/assets/font.woff2').subscribe();

      const req = httpTestingController.expectOne('/assets/font.woff2');
      expect(req.request.url).toBe('/assets/font.woff2');
      req.flush('');
    });

    it('should NOT add cv parameter to PWA icons', () => {
      httpClient.get('/assets/icons/icon-192x192.png').subscribe();

      const req = httpTestingController.expectOne('/assets/icons/icon-192x192.png');
      expect(req.request.url).toBe('/assets/icons/icon-192x192.png');
      req.flush('');
    });

    it('should add cv parameter to published asset requests', () => {
      httpClient.get('/assets/my-image.png').subscribe();

      const req = httpTestingController.expectOne(
        (request) =>
          request.url.startsWith('/assets/my-image.png') && request.url.includes('cv=test-cv-123')
      );
      expect(req.request.url).toBe('/assets/my-image.png?cv=test-cv-123');
      req.flush('');
    });

    it('should NOT add cv parameter if already present', () => {
      httpClient.get('/content/_manifest.json?cv=existing').subscribe();

      const req = httpTestingController.expectOne('/content/_manifest.json?cv=existing');
      expect(req.request.url).toBe('/content/_manifest.json?cv=existing');
      req.flush({});
    });

    it('should NOT add cv parameter to API requests', () => {
      httpClient.get('/api/config').subscribe();

      const req = httpTestingController.expectOne('/api/config');
      expect(req.request.url).toBe('/api/config');
      req.flush({});
    });

    it('should NOT intercept POST requests', () => {
      httpClient.post('/content/upload', {}).subscribe();

      const req = httpTestingController.expectOne('/content/upload');
      expect(req.request.url).toBe('/content/upload');
      expect(req.request.method).toBe('POST');
      req.flush({});
    });

    it('should append cv parameter with & if URL already has query', () => {
      httpClient.get('/content/page.html?foo=bar').subscribe();

      const req = httpTestingController.expectOne(
        (request) => request.url.includes('foo=bar') && request.url.includes('cv=test-cv-123')
      );
      expect(req.request.url).toBe('/content/page.html?foo=bar&cv=test-cv-123');
      req.flush('');
    });
  });

  describe('when no version is set', () => {
    it('should NOT add cv parameter when version is empty', () => {
      httpClient.get('/content/_manifest.json').subscribe();

      const req = httpTestingController.expectOne('/content/_manifest.json');
      expect(req.request.url).toBe('/content/_manifest.json');
      req.flush({});
    });
  });
});
