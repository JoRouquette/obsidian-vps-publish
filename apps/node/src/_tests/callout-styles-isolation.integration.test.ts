/**
 * Integration tests for callout styles isolation and persistence
 *
 * Tests:
 * 1. Session A callouts don't leak into Session B
 * 2. Callout styles persist across rebuilds
 * 3. Styles are correctly loaded from storage during rebuild
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { type CalloutStylePayload, type SessionNotesStoragePort } from '@core-application';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { SessionNotesFileStorage } from '../infra/filesystem/session-notes-file.storage';
import { CalloutRendererService } from '../infra/markdown/callout-renderer.service';

describe('Callout Styles Isolation - Integration Tests', () => {
  let tempDir: string;
  let notesStorage: SessionNotesStoragePort;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '..', 'tmp', 'test-callout-integration-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    // Setup storage
    notesStorage = new SessionNotesFileStorage(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  describe('Session Isolation', () => {
    it('should not leak callout styles between sessions', async () => {
      const sessionA = 'session-a-' + Date.now();
      const sessionB = 'session-b-' + Date.now();

      // Session A: Red callout styles
      const stylesA: CalloutStylePayload[] = [
        {
          path: 'snippets/red-callouts.css',
          css: '.callout[data-callout="red"] { background-color: red; }',
        },
      ];

      // Session B: No callout styles
      const stylesB: CalloutStylePayload[] = [];

      // Save styles for both sessions
      await notesStorage.saveCalloutStyles(sessionA, stylesA);
      await notesStorage.saveCalloutStyles(sessionB, stylesB);

      // Load styles back
      const loadedA = await notesStorage.loadCalloutStyles(sessionA);
      const loadedB = await notesStorage.loadCalloutStyles(sessionB);

      // Verify Session A has red styles
      expect(loadedA).toHaveLength(1);
      expect(loadedA[0]?.css).toContain('background-color: red');

      // Verify Session B has NO styles (isolation)
      expect(loadedB).toHaveLength(0);
    });
  });

  describe('Persistence and Rebuild', () => {
    it('should persist callout styles to filesystem', async () => {
      const sessionId = 'session-persist-' + Date.now();

      const styles: CalloutStylePayload[] = [
        {
          path: 'snippets/custom.css',
          css: '.callout[data-callout="custom"] { border: 1px solid green; }',
        },
      ];

      // Save styles
      await notesStorage.saveCalloutStyles(sessionId, styles);

      // Verify file exists in filesystem
      const stylesPath = path.join(tempDir, '.staging', sessionId, '_callout-styles.json');
      const fileExists = await fs
        .access(stylesPath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);

      // Read file and verify content
      const fileContent = await fs.readFile(stylesPath, 'utf-8');
      const parsed = JSON.parse(fileContent);

      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        path: 'snippets/custom.css',
        css: '.callout[data-callout="custom"] { border: 1px solid green; }',
      });
    });

    it('should reload callout styles after server restart (rebuild scenario)', async () => {
      const sessionId = 'session-rebuild-' + Date.now();

      // Step 1: Save styles (simulating initial upload)
      const styles: CalloutStylePayload[] = [
        {
          path: 'snippets/reboot.css',
          css: '.callout[data-callout="reboot"] { font-weight: bold; }',
        },
      ];
      await notesStorage.saveCalloutStyles(sessionId, styles);

      // Step 2: Create new storage instance (simulating server restart)
      const newNotesStorage = new SessionNotesFileStorage(tempDir);

      // Step 3: Load styles back
      const reloadedStyles = await newNotesStorage.loadCalloutStyles(sessionId);

      // Verify styles were correctly reloaded
      expect(reloadedStyles).toHaveLength(1);
      expect(reloadedStyles[0]?.path).toBe('snippets/reboot.css');
      expect(reloadedStyles[0]?.css).toContain('font-weight: bold');
    });

    it('should return empty array if no styles file exists', async () => {
      const sessionId = 'session-no-styles-' + Date.now();

      // Try to load styles for a session that never had styles saved
      const styles = await notesStorage.loadCalloutStyles(sessionId);

      // Should return empty array (not throw error)
      expect(styles).toEqual([]);
    });

    it('should handle empty callout styles array', async () => {
      const sessionId = 'session-empty-' + Date.now();

      // Save empty array
      await notesStorage.saveCalloutStyles(sessionId, []);

      // Load back
      const loaded = await notesStorage.loadCalloutStyles(sessionId);

      // Should return empty array
      expect(loaded).toEqual([]);
    });
  });

  describe('Backward Compatibility with Singleton', () => {
    it('should not interfere with singleton CalloutRendererService', () => {
      // This test verifies that the new session-scoped storage
      // doesn't break the legacy singleton pattern used by older code

      const singleton = new CalloutRendererService();

      // Register styles in singleton (old way)
      singleton.extendFromStyles([
        {
          path: 'legacy.css',
          css: '.callout[data-callout="legacy"] { opacity: 0.8; }',
        },
      ]);

      // Verify singleton still works
      const userCss = singleton.getUserCss();
      expect(userCss).toContain('opacity: 0.8');
      expect(userCss).toContain('data-callout="legacy"');
    });
  });
});
