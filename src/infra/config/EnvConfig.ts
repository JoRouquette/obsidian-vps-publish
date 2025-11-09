export class EnvConfig {
  private static norm(s: string | undefined): string {
    return (s ?? '').replace(/^\uFEFF/, '').trim();
  }

  static apiKey(): string {
    return this.norm(process.env.API_KEY);
  }
  static contentRoot(): string {
    return this.norm(process.env.CONTENT_ROOT) || './tmp/site';
  }
  static port(): number {
    const p = Number(this.norm(process.env.PORT));
    return Number.isFinite(p) ? p : 3000;
  }
  static nodeEnv(): string {
    return this.norm(process.env.NODE_ENV) || 'development';
  }
}
