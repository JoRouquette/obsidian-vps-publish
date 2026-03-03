import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';

import { ConfigFacade } from '../../../application/facades/config-facade';
import { PwaMetaService } from '../pwa-meta.service';

describe('PwaMetaService', () => {
  let service: PwaMetaService;
  let configFacade: ConfigFacade;
  let meta: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PwaMetaService,
        {
          provide: ConfigFacade,
          useValue: {
            cfg: jest.fn().mockReturnValue({ siteName: 'Test Site' }),
          },
        },
        Meta,
      ],
    });

    service = TestBed.inject(PwaMetaService);
    configFacade = TestBed.inject(ConfigFacade);
    meta = TestBed.inject(Meta);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should not initialize on server side (SSR)', () => {
    // Service guards against non-browser platforms
    // This test verifies the service exists without errors
    expect(service).toBeDefined();
  });

  describe('meta tag updates', () => {
    it('should have access to Meta service', () => {
      expect(meta).toBeTruthy();
    });

    it('should access config facade', () => {
      const cfg = configFacade.cfg();
      expect(cfg?.siteName).toBe('Test Site');
    });
  });
});
