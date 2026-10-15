import {
  humanizePropertyKey,
  normalizePropertyKey,
  scalarToString,
} from '../../utils/string.utils';

describe('scalarToString', () => {
  it('keeps the String() form of primitives', () => {
    expect(scalarToString('a')).toBe('a');
    expect(scalarToString(42)).toBe('42');
    expect(scalarToString(false)).toBe('false');
    expect(scalarToString(10n)).toBe('10');
    expect(scalarToString(null)).toBe('null');
    expect(scalarToString(undefined)).toBe('undefined');
    expect(scalarToString(Symbol('s'))).toBe('Symbol(s)');
  });

  it('never yields "[object Object]" nor function source', () => {
    expect(scalarToString({ key: 'value' })).toBe('');
    expect(scalarToString(() => 1)).toBe('');
  });
});

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
