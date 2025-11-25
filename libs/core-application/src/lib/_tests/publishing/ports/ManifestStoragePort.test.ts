import { ManifestPort } from '../../../publishing/ports/ManifestStoragePort';
import { Manifest } from '@core-domain';

describe('ManifestPort', () => {
  let manifestPort: ManifestPort;
  let mockManifest: Manifest;

  beforeEach(() => {
    mockManifest = {
      sessionId: 'session-1',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: 'page-1',
          title: 'Home',
          slug: 'home',
          route: '/home',
          publishedAt: new Date(),
        },
      ],
    };
    manifestPort = {
      load: jest.fn(),
      save: jest.fn(),
      rebuildIndex: jest.fn(),
    };
  });

  describe('load', () => {
    it('should resolve to a Manifest when one exists', async () => {
      (manifestPort.load as jest.Mock).mockResolvedValue(mockManifest);
      const result = await manifestPort.load();
      expect(result).toBe(mockManifest);
    });

    it('should resolve to null when no manifest exists', async () => {
      (manifestPort.load as jest.Mock).mockResolvedValue(null);
      const result = await manifestPort.load();
      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should call save with the provided manifest', async () => {
      await manifestPort.save(mockManifest);
      expect(manifestPort.save).toHaveBeenCalledWith(mockManifest);
    });
  });

  describe('rebuildIndex', () => {
    it('should call rebuildIndex with the provided manifest', async () => {
      await manifestPort.rebuildIndex(mockManifest);
      expect(manifestPort.rebuildIndex).toHaveBeenCalledWith(mockManifest);
    });
  });
});
