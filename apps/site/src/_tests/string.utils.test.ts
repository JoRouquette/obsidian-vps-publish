import { StringUtils } from '../application/utils/string.utils';

describe('StringUtils', () => {
  it('capitalizes first letter', () => {
    expect(StringUtils.capitalizeFirstLetter('hello')).toBe('Hello');
    expect(StringUtils.capitalizeFirstLetter('')).toBe('');
  });

  it('builds normalized routes', () => {
    expect(StringUtils.buildRoute(' /a/', '/b/c')).toBe('/ /a/b/c');
    expect(StringUtils.buildRoute('///a///', 'b', 'c')).toBe('/a/b/c');
    expect(StringUtils.buildRoute()).toBe('/');
  });
});
