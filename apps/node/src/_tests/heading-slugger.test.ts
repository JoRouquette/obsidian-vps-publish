import { HeadingSlugger } from '../infra/markdown/heading-slugger';

describe('HeadingSlugger', () => {
  let slugger: HeadingSlugger;

  beforeEach(() => {
    slugger = new HeadingSlugger();
  });

  it('should convert simple text to lowercase slug', () => {
    expect(slugger.slugify('Simple Heading')).toBe('simple-heading');
  });

  it('should remove accents and diacritics', () => {
    expect(slugger.slugify('Les Héros Légendaires')).toBe('les-heros-legendaires');
    expect(slugger.slugify('Café et thé')).toBe('cafe-et-the');
    expect(slugger.slugify('Été à Paris')).toBe('ete-a-paris');
  });

  it('should handle special characters', () => {
    expect(slugger.slugify("C'est l'été!")).toBe('cest-lete');
    expect(slugger.slugify('Question?')).toBe('question');
    expect(slugger.slugify('Hello, World!')).toBe('hello-world');
  });

  it('should collapse multiple spaces to single hyphen', () => {
    expect(slugger.slugify('Multiple   Spaces   Here')).toBe('multiple-spaces-here');
  });

  it('should collapse multiple hyphens', () => {
    expect(slugger.slugify('Too---Many---Hyphens')).toBe('too-many-hyphens');
  });

  it('should trim leading and trailing hyphens', () => {
    expect(slugger.slugify('-Leading')).toBe('leading');
    expect(slugger.slugify('Trailing-')).toBe('trailing');
    expect(slugger.slugify('---Both---')).toBe('both');
  });

  it('should handle French text with complex diacritics', () => {
    expect(slugger.slugify('Système de Gouvernance')).toBe('systeme-de-gouvernance');
    expect(slugger.slugify('Dédommagements')).toBe('dedommagements');
    expect(slugger.slugify('Événements historiques')).toBe('evenements-historiques');
  });

  it('should handle empty string', () => {
    expect(slugger.slugify('')).toBe('');
  });

  it('should handle string with only special characters', () => {
    expect(slugger.slugify('!!!')).toBe('');
    expect(slugger.slugify('---')).toBe('');
  });

  it('should preserve numbers', () => {
    expect(slugger.slugify('Chapter 123')).toBe('chapter-123');
    expect(slugger.slugify('Section 4.5')).toBe('section-45');
  });

  it('should handle underscores', () => {
    expect(slugger.slugify('snake_case_title')).toBe('snake_case_title');
    expect(slugger.slugify('Mixed_Title Format')).toBe('mixed_title-format');
  });

  it('should match real-world examples from Le Code document', () => {
    expect(slugger.slugify('Origine et Histoire')).toBe('origine-et-histoire');
    expect(slugger.slugify('Mythes fondateurs')).toBe('mythes-fondateurs');
    expect(slugger.slugify('Système de gouvernance')).toBe('systeme-de-gouvernance');
    expect(slugger.slugify('Les différents contrats')).toBe('les-differents-contrats');
  });
});
