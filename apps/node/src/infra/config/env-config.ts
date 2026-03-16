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

  static maxEventLoopLagMs(): number {
    const val = Number(this.norm(process.env.MAX_EVENT_LOOP_LAG_MS));
    if (Number.isFinite(val) && val > 0) return val;
    return this.nodeEnv() === 'test' ? 5000 : 200;
  }

  static maxMemoryUsageMB(): number {
    const val = Number(this.norm(process.env.MAX_MEMORY_USAGE_MB));
    if (Number.isFinite(val) && val > 0) return val;
    return this.nodeEnv() === 'test' ? 2048 : 500;
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

  // ===== Image Optimization Configuration =====

  /**
   * Enable automatic image optimization (compression, format conversion).
   * When enabled, images will be compressed and optionally converted to WebP.
   * Default: true
   */
  static imageOptimizationEnabled(): boolean {
    const val = this.norm(process.env.IMAGE_OPTIMIZATION_ENABLED).toLowerCase();
    if (val === 'false' || val === '0') return false;
    return true; // Enabled by default
  }

  /**
   * Convert images to WebP format for better compression.
   * WebP typically offers 25-35% better compression than JPEG/PNG.
   * Default: true
   */
  static imageConvertToWebp(): boolean {
    const val = this.norm(process.env.IMAGE_CONVERT_TO_WEBP).toLowerCase();
    if (val === 'false' || val === '0') return false;
    return true; // Enabled by default
  }

  /**
   * Image compression quality (1-100).
   * Higher values = better quality but larger files.
   * Default: 85
   */
  static imageQuality(): number {
    const val = Number(this.norm(process.env.IMAGE_QUALITY));
    if (Number.isFinite(val) && val >= 1 && val <= 100) return val;
    return 85;
  }

  /**
   * Maximum image width in pixels. Larger images will be resized.
   * Default: 4096
   */
  static imageMaxWidth(): number {
    const val = Number(this.norm(process.env.IMAGE_MAX_WIDTH));
    return Number.isFinite(val) && val > 0 ? val : 4096;
  }

  /**
   * Maximum image height in pixels. Larger images will be resized.
   * Default: 4096
   */
  static imageMaxHeight(): number {
    const val = Number(this.norm(process.env.IMAGE_MAX_HEIGHT));
    return Number.isFinite(val) && val > 0 ? val : 4096;
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

  /**
   * Enable Angular SSR (Server-Side Rendering).
   * When enabled, the server will render Angular pages server-side for better SEO.
   * Default: true in production, false in development
   */
  static ssrEnabled(): boolean {
    const val = this.norm(process.env.SSR_ENABLED).toLowerCase();
    if (val === 'false' || val === '0') return false;
    if (val === 'true' || val === '1') return true;
    // Default: enabled in production
    return this.nodeEnv() === 'production';
  }

  /**
   * Path to Angular SSR server dist folder.
   * Contains: main.server.mjs, index.server.html
   * Default: /ui-server (Docker) or ./tmp/ui-server (local)
   */
  static uiServerRoot(): string {
    return path.resolve(this.norm(process.env.UI_SERVER_ROOT) || './tmp/ui-server');
  }
}
