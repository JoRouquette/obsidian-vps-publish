import path from 'node:path';

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
    const key = this.norm(process.env.API_KEY);
    if (key) return key;

    // En développement ou tests, retourne une clé par défaut
    const env = this.nodeEnv();
    if (env === 'development' || env === 'test') {
      return 'devkeylocal';
    }

    throw new Error('API_KEY is not set in environment variables');
  }

  static uiRoot(): string {
    return path.resolve(this.norm(process.env.UI_ROOT) || './tmp/ui');
  }

  static assetsRoot(): string {
    return path.resolve(this.norm(process.env.ASSETS_ROOT) || './tmp/assets');
  }

  static contentRoot(): string {
    return path.resolve(this.norm(process.env.CONTENT_ROOT) || './tmp/site-content');
  }

  static port(): number {
    const p = Number(this.norm(process.env.PORT ?? '3000'));
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

  static siteName(): string {
    return this.norm(process.env.SITE_NAME) || "Scribe d'Ektaron";
  }

  static author(): string {
    return this.norm(process.env.AUTHOR) || 'Author Name';
  }

  static repoUrl(): string {
    return this.norm(process.env.REPO_URL) || '';
  }

  static reportIssuesUrl(): string {
    return this.norm(process.env.REPORT_ISSUES_URL) || '';
  }

  static homeWelcomeTitle(): string {
    return this.norm(process.env.HOME_WELCOME_TITLE) || '';
  }

  static maxActiveRequests(): number {
    const val = Number(this.norm(process.env.MAX_ACTIVE_REQUESTS));
    return Number.isFinite(val) && val > 0 ? val : 200;
  }

  static maxConcurrentFinalizationJobs(): number {
    const val = Number(this.norm(process.env.MAX_CONCURRENT_FINALIZATION_JOBS));
    return Number.isFinite(val) && val > 0 ? val : 8;
  }

  /**
   * Maximum allowed asset size in bytes.
   * Default: 10MB (10 * 1024 * 1024 bytes)
   */
  static maxAssetSizeBytes(): number {
    const val = Number(this.norm(process.env.MAX_ASSET_SIZE_BYTES));
    return Number.isFinite(val) && val > 0 ? val : 10 * 1024 * 1024;
  }

  /**
   * Enable virus scanning for uploaded assets (requires ClamAV daemon)
   * Default: false (uses NoopAssetScanner)
   */
  static virusScannerEnabled(): boolean {
    const val = this.norm(process.env.VIRUS_SCANNER_ENABLED).toLowerCase();
    return val === 'true' || val === '1';
  }

  /**
   * ClamAV daemon host (when virus scanning is enabled)
   * Default: localhost
   */
  static clamavHost(): string {
    return this.norm(process.env.CLAMAV_HOST) || 'localhost';
  }

  /**
   * ClamAV daemon port (when virus scanning is enabled)
   * Default: 3310 (standard clamd port)
   */
  static clamavPort(): number {
    const val = Number(this.norm(process.env.CLAMAV_PORT));
    return Number.isFinite(val) && val > 0 ? val : 3310;
  }

  /**
   * ClamAV scan timeout in milliseconds
   * Default: 10000 (10 seconds)
   */
  static clamavTimeout(): number {
    const val = Number(this.norm(process.env.CLAMAV_TIMEOUT));
    return Number.isFinite(val) && val > 0 ? val : 10000;
  }

  /**
   * Base URL for the public site (used for SEO: sitemap, canonical URLs)
   * Example: https://example.com
   */
  static baseUrl(): string {
    return (
      this.norm(process.env.BASE_URL) ||
      (() => {
        throw new Error('BASE_URL is not set in environment variables');
      })()
    );
  }
}
