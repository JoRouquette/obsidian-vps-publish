import { isLeafletControlLink, isLeafletDebugLoggingEnabled } from '../leaflet-content.util';

describe('leaflet-content util', () => {
  describe('isLeafletControlLink', () => {
    it('returns true for a leaflet zoom control anchor', () => {
      const link = document.createElement('a');
      link.classList.add('leaflet-control-zoom-in');

      expect(isLeafletControlLink(link)).toBe(true);
    });

    it('returns true for an anchor inside a leaflet control container', () => {
      const container = document.createElement('div');
      container.classList.add('leaflet-control-container');
      const link = document.createElement('a');
      container.appendChild(link);

      expect(isLeafletControlLink(link)).toBe(true);
    });

    it('returns false for a regular content link', () => {
      const link = document.createElement('a');
      link.setAttribute('href', '/notes/page');

      expect(isLeafletControlLink(link)).toBe(false);
    });
  });

  describe('isLeafletDebugLoggingEnabled', () => {
    afterEach(() => localStorage.clear());

    it('is false when not running in the browser', () => {
      localStorage.setItem('vps:leaflet:debug', '1');

      expect(isLeafletDebugLoggingEnabled(false)).toBe(false);
    });

    it('is false when no debug flag is set', () => {
      expect(isLeafletDebugLoggingEnabled(true)).toBe(false);
    });

    it('is true when a debug flag is set', () => {
      localStorage.setItem('leaflet:debug', '1');

      expect(isLeafletDebugLoggingEnabled(true)).toBe(true);
    });
  });
});
