export class EnvConfig {
  private static norm(s: string | undefined): string {
    return (s ?? '').replace(/^\uFEFF/, '').trim();
  }

  static allowedOrigins(): string[] {
    const origins = this.norm(process.env.ALLOWED_ORIGINS);
    if (!origins) return [];
    return origins
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  static apiKey(): string {
    return this.norm(process.env.API_KEY);
  }

  static uiRoot(): string {
    return this.norm(process.env.UI_ROOT) || './tmp/ui';
  }

  static assetsRoot(): string {
    return this.norm(process.env.ASSETS_ROOT) || './tmp/assets';
  }

  static contentRoot(): string {
    return this.norm(process.env.CONTENT_ROOT) || './tmp/site-content';
  }

  static port(): number {
    const p = Number(this.norm(process.env.PORT));
    return Number.isFinite(p) ? p : 3000;
  }

  static nodeEnv(): string {
    return this.norm(process.env.NODE_ENV) || 'development';
  }

  static loggerLevel(): 'debug' | 'info' | 'warn' | 'error' {
    const level = this.norm(process.env.LOGGER_LEVEL).toLowerCase();
    if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
      return level;
    }
    return 'info';
  }
}
