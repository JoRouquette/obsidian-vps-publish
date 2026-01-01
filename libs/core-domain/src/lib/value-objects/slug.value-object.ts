export class Slug {
  private constructor(readonly value: string) {
    if (!value) {
      throw new Error('Slug cannot be empty');
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      throw new Error(
        `Slug "${value}" contains invalid characters. Only lowercase letters, numbers, and hyphens are allowed.`
      );
    }
  }

  static from(value: string) {
    return new Slug(value);
  }

  static fromRoute(route: string) {
    const last =
      route
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .pop() ?? '';
    const norm = decodeURIComponent(last)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$|/g, '');
    return Slug.from(norm || 'index');
  }

  toString() {
    return this.value;
  }
}
