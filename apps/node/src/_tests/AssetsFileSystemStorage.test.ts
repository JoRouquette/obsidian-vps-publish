import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AssetsFileSystemStorage } from '../infra/filesystem/AssetsFileSystemStorage';

describe('AssetsFileSystemStorage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves multiple assets to filesystem', async () => {
    const storage = new AssetsFileSystemStorage(tmpDir);
    await storage.save([
      { filename: 'img/a.png', content: Buffer.from('foo') },
      { filename: 'b.txt', content: Buffer.from('bar') },
    ]);

    expect(fs.readFileSync(path.join(tmpDir, 'img', 'a.png'), 'utf8')).toBe('foo');
    expect(fs.readFileSync(path.join(tmpDir, 'b.txt'), 'utf8')).toBe('bar');
  });

  it('rejects path traversal', async () => {
    const storage = new AssetsFileSystemStorage(tmpDir);
    await expect(
      storage.save([{ filename: '../evil.txt', content: Buffer.from('x') }])
    ).rejects.toThrow();
  });

  it('bubbles up write errors', async () => {
    const storage = new AssetsFileSystemStorage(tmpDir);
    jest.spyOn(fs.promises as any, 'writeFile').mockRejectedValueOnce(new Error('fail'));
    await expect(storage.save([{ filename: 'x.txt', content: Buffer.from('x') }])).rejects.toThrow(
      'fail'
    );
  });
});
