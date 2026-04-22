import * as coreApplication from '../core-application';

describe('core-application barrel exports', () => {
  it('should export session handlers and repository', () => {
    expect(coreApplication.AbortSessionHandler).toBeDefined();
    expect(coreApplication.CreateSessionHandler).toBeDefined();
    expect(coreApplication.FinishSessionHandler).toBeDefined();
  });

  it('should export publishing handlers', () => {
    expect(coreApplication.UploadAssetsHandler).toBeDefined();
    expect(coreApplication.UploadNotesHandler).toBeDefined();
  });

  it('should expose handler classes at runtime', () => {
    const expectedKeys = [
      'AbortSessionHandler',
      'CreateSessionHandler',
      'FinishSessionHandler',
      'UploadAssetsHandler',
      'UploadNotesHandler',
    ];
    const exportedKeys = Object.keys(coreApplication);
    expectedKeys.forEach((key) => {
      expect(exportedKeys).toContain(key);
    });
  });
});
