import { type CustomIndexConfig, type LoggerPort, LogLevel } from '@core-domain';

import { ResolveCustomIndexService } from '../../vault-parsing/services/resolve-custom-index.service';

class MockLogger implements LoggerPort {
  level = LogLevel.debug;
  child(): LoggerPort {
    return this;
  }
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

interface VaultReadPort {
  readFile(path: string): Promise<string>;
}

class MockVaultPort implements VaultReadPort {
  private files: Map<string, string> = new Map();

  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (!content) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }
}

describe('ResolveCustomIndexService', () => {
  let logger: LoggerPort;
  let vaultPort: MockVaultPort;
  let service: ResolveCustomIndexService;

  beforeEach(() => {
    logger = new MockLogger();
    vaultPort = new MockVaultPort();
  });

  describe('getIndexForFolder', () => {
    it('should return custom index config for matching folder', () => {
      const configs: CustomIndexConfig[] = [
        {
          id: 'index-1',
          folderPath: 'campagne/',
          indexFilePath: 'campagne/_index.md',
        },
        {
          id: 'index-2',
          folderPath: 'world/lore/',
          indexFilePath: 'world/lore/_index.md',
        },
      ];

      service = new ResolveCustomIndexService(configs, vaultPort, logger);

      const result = service.getIndexForFolder('campagne/');
      expect(result).toBeDefined();
      expect(result?.id).toBe('index-1');
      expect(result?.indexFilePath).toBe('campagne/_index.md');
    });

    it('should normalize folder paths for comparison', () => {
      const configs: CustomIndexConfig[] = [
        {
          id: 'index-1',
          folderPath: 'campagne/',
          indexFilePath: 'campagne/_index.md',
        },
      ];

      service = new ResolveCustomIndexService(configs, vaultPort, logger);

      // Should match with different trailing slashes
      const result1 = service.getIndexForFolder('campagne');
      const result2 = service.getIndexForFolder('campagne/');
      const result3 = service.getIndexForFolder('/campagne/');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();
      expect(result1?.id).toBe('index-1');
      expect(result2?.id).toBe('index-1');
      expect(result3?.id).toBe('index-1');
    });

    it('should return undefined for non-matching folder', () => {
      const configs: CustomIndexConfig[] = [
        {
          id: 'index-1',
          folderPath: 'campagne/',
          indexFilePath: 'campagne/_index.md',
        },
      ];

      service = new ResolveCustomIndexService(configs, vaultPort, logger);

      const result = service.getIndexForFolder('other-folder/');
      expect(result).toBeUndefined();
    });

    it('should not return root index when searching for folder', () => {
      const configs: CustomIndexConfig[] = [
        {
          id: 'root-index',
          folderPath: '',
          indexFilePath: '_index.md',
          isRootIndex: true,
        },
      ];

      service = new ResolveCustomIndexService(configs, vaultPort, logger);

      const result = service.getIndexForFolder('campagne/');
      expect(result).toBeUndefined();
    });
  });

  describe('getRootIndex', () => {
    it('should return root index config when marked as root', () => {
      const configs: CustomIndexConfig[] = [
        {
          id: 'root-index',
          folderPath: '',
          indexFilePath: '_index.md',
          isRootIndex: true,
        },
        {
          id: 'folder-index',
          folderPath: 'campagne/',
          indexFilePath: 'campagne/_index.md',
        },
      ];

      service = new ResolveCustomIndexService(configs, vaultPort, logger);

      const result = service.getRootIndex();
      expect(result).toBeDefined();
      expect(result?.id).toBe('root-index');
      expect(result?.isRootIndex).toBe(true);
    });

    it('should return root index config when folder path is empty', () => {
      const configs: CustomIndexConfig[] = [
        {
          id: 'root-index',
          folderPath: '',
          indexFilePath: '_index.md',
        },
      ];

      service = new ResolveCustomIndexService(configs, vaultPort, logger);

      const result = service.getRootIndex();
      expect(result).toBeDefined();
      expect(result?.id).toBe('root-index');
    });

    it('should return undefined when no root index configured', () => {
      const configs: CustomIndexConfig[] = [
        {
          id: 'folder-index',
          folderPath: 'campagne/',
          indexFilePath: 'campagne/_index.md',
        },
      ];

      service = new ResolveCustomIndexService(configs, vaultPort, logger);

      const result = service.getRootIndex();
      expect(result).toBeUndefined();
    });
  });

  describe('getIndexContent', () => {
    it('should read and return index file content', async () => {
      const configs: CustomIndexConfig[] = [
        {
          id: 'index-1',
          folderPath: 'campagne/',
          indexFilePath: 'campagne/_index.md',
        },
      ];

      const indexContent = `# Campaign Index

This is the campaign overview.`;

      vaultPort.setFile('campagne/_index.md', indexContent);
      service = new ResolveCustomIndexService(configs, vaultPort, logger);

      const config = configs[0];
      const result = await service.getIndexContent(config);

      expect(result).toBe(indexContent);
    });

    it('should return null when file does not exist', async () => {
      const configs: CustomIndexConfig[] = [
        {
          id: 'index-1',
          folderPath: 'campagne/',
          indexFilePath: 'campagne/_index.md',
        },
      ];

      service = new ResolveCustomIndexService(configs, vaultPort, logger);

      const config = configs[0];
      const result = await service.getIndexContent(config);

      expect(result).toBeNull();
    });
  });

  describe('getAllIndexes', () => {
    it('should return all configured indexes', () => {
      const configs: CustomIndexConfig[] = [
        {
          id: 'root-index',
          folderPath: '',
          indexFilePath: '_index.md',
          isRootIndex: true,
        },
        {
          id: 'folder-index-1',
          folderPath: 'campagne/',
          indexFilePath: 'campagne/_index.md',
        },
        {
          id: 'folder-index-2',
          folderPath: 'world/lore/',
          indexFilePath: 'world/lore/_index.md',
        },
      ];

      service = new ResolveCustomIndexService(configs, vaultPort, logger);

      const result = service.getAllIndexes();
      expect(result).toHaveLength(3);
      expect(result).toEqual(configs);
    });
  });
});
