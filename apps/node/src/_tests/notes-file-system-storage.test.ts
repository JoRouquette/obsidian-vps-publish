import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { NotesFileSystemStorage } from '../infra/filesystem/notes-file-system.storage';

describe('NotesFileSystemStorage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves HTML to normalized route with slug', async () => {
    const storage = new NotesFileSystemStorage(tmpDir);
    await storage.save({ route: '/docs/getting-started', content: '<p>Hello</p>', slug: 'getting-started' });

    const target = path.join(tmpDir, 'docs', 'getting-started.html');
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe('<p>Hello</p>');
  });

  it('saves to root when no route provided', async () => {
    const storage = new NotesFileSystemStorage(tmpDir);
    await storage.save({ route: '', content: '<p>Root</p>', slug: 'index' });

    const target = path.join(tmpDir, 'index.html');
    expect(fs.existsSync(target)).toBe(true);
  });

  it('propagates path traversal errors', async () => {
    const storage = new NotesFileSystemStorage(tmpDir);
    await expect(
      storage.save({ route: '/../evil', content: '<p>x</p>', slug: 'err' })
    ).rejects.toThrow(/Path traversal/);
  });
});
