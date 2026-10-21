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

  it('keeps the String() form of edge primitives', () => {
    expect(scalarToString('')).toBe('');
    expect(scalarToString(NaN)).toBe('NaN');
    expect(scalarToString(-Infinity)).toBe('-Infinity');
    expect(scalarToString(-0)).toBe('0');
    expect(scalarToString(Symbol())).toBe('Symbol()');
  });

  it('never yields "[object Object]" nor function source', () => {
    expect(scalarToString({ key: 'value' })).toBe('');
    expect(scalarToString(() => 1)).toBe('');
  });

  it('yields an empty string for every non-primitive, never its String() form', () => {
    class Box {
      constructor(readonly value: string) {}
    }

    expect(scalarToString(['a', 'b'])).toBe('');
    expect(scalarToString(new Date(0))).toBe('');
    expect(scalarToString(new Box('x'))).toBe('');
    expect(scalarToString(Object.create(null))).toBe('');
    expect(scalarToString(new Map([['k', 'v']]))).toBe('');
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
