import { humanizePropertyKey, normalizePropertyKey } from '../../utils/string.utils';

describe('normalizePropertyKey', () => {
  it('converts separated keys to camelCase', () => {
    expect(normalizePropertyKey('effet-secondaire')).toBe('effetSecondaire');
    expect(normalizePropertyKey('type_creature')).toBe('typeCreature');
    expect(normalizePropertyKey('type-creature')).toBe('typeCreature');
    expect(normalizePropertyKey('effet secondaire')).toBe('effetSecondaire');
  });

  it('keeps camelCase keys untouched', () => {
    expect(normalizePropertyKey('effetSecondaire')).toBe('effetSecondaire');
    expect(normalizePropertyKey('typeCreature')).toBe('typeCreature');
  });
});

describe('humanizePropertyKey', () => {
  it('produces human friendly labels from camelCase', () => {
    expect(humanizePropertyKey('effetSecondaire')).toBe('Effet secondaire');
    expect(humanizePropertyKey('typeCreature')).toBe('Type creature');
  });

  it('handles keys with separators', () => {
    expect(humanizePropertyKey('type-creature')).toBe('Type creature');
    expect(humanizePropertyKey('effet secondaire')).toBe('Effet secondaire');
  });
});
