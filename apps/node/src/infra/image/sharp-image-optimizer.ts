import type {
  ImageOptimizationConfig,
  ImageOptimizerPort,
  LoggerPort,
  OptimizedImage,
} from '@core-domain';
import sharp from 'sharp';

/**
 * Default configuration for image optimization
 */
const DEFAULT_CONFIG: ImageOptimizationConfig = {
  enabled: true,
  convertToWebp: true,
  quality: 85,
  maxWidth: 4096,
  maxHeight: 4096,
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  preserveFormat: false,
};

/**
 * Supported input image formats
 */
const OPTIMIZABLE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.tiff',
  '.tif',
  '.avif',
]);

/**
 * Image optimizer implementation using Sharp library.
 * Handles compression, format conversion (to WebP), and resizing.
 */
export class SharpImageOptimizer implements ImageOptimizerPort {
  private readonly config: ImageOptimizationConfig;
  private readonly logger?: LoggerPort;

  constructor(config?: Partial<ImageOptimizationConfig>, logger?: LoggerPort) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger?.child({ service: 'SharpImageOptimizer' });

    this.logger?.info('SharpImageOptimizer initialized', {
      enabled: this.config.enabled,
      convertToWebp: this.config.convertToWebp,
      quality: this.config.quality,
      maxWidth: this.config.maxWidth,
      maxHeight: this.config.maxHeight,
      maxSizeBytes: this.config.maxSizeBytes,
    });
  }

  getConfig(): ImageOptimizationConfig {
    return { ...this.config };
  }

  isOptimizable(filename: string): boolean {
    const ext = this.getExtension(filename).toLowerCase();
    return OPTIMIZABLE_EXTENSIONS.has(ext);
  }

  async optimize(
    content: Uint8Array,
    filename: string,
    configOverrides?: Partial<ImageOptimizationConfig>
  ): Promise<OptimizedImage> {
    const config = { ...this.config, ...configOverrides };
    const originalSize = content.length;

    // If optimization is disabled, return original
    if (!config.enabled) {
      this.logger?.debug('Optimization disabled, returning original', { filename });
      return this.createResult(content, filename, originalSize, false);
    }

    // If not an optimizable format, return original
    if (!this.isOptimizable(filename)) {
      this.logger?.debug('File is not an optimizable image format', { filename });
      return this.createResult(content, filename, originalSize, false);
    }

    try {
      const startTime = Date.now();

      // Load image with sharp
      let pipeline = sharp(Buffer.from(content));
      const metadata = await pipeline.metadata();

      if (!metadata.width || !metadata.height) {
        this.logger?.warn('Could not read image dimensions', { filename });
        return this.createResult(content, filename, originalSize, false);
      }

      this.logger?.debug('Processing image', {
        filename,
        originalWidth: metadata.width,
        originalHeight: metadata.height,
        originalFormat: metadata.format,
        originalSize,
      });

      // Reset pipeline after reading metadata
      pipeline = sharp(Buffer.from(content));

      // Resize if needed
      const needsResize = metadata.width > config.maxWidth || metadata.height > config.maxHeight;

      if (needsResize) {
        pipeline = pipeline.resize(config.maxWidth, config.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
        this.logger?.debug('Resizing image', {
          filename,
          from: `${metadata.width}x${metadata.height}`,
          maxTo: `${config.maxWidth}x${config.maxHeight}`,
        });
      }

      // Determine output format
      let outputFormat: 'webp' | 'jpeg' | 'png' = 'webp';
      let outputExtension = '.webp';

      if (config.preserveFormat) {
        switch (metadata.format) {
          case 'jpeg':
            outputFormat = 'jpeg';
            outputExtension = '.jpg';
            break;
          case 'png':
            outputFormat = 'png';
            outputExtension = '.png';
            break;
          default:
            // For other formats, still use WebP
            break;
        }
      } else if (!config.convertToWebp) {
        // Keep original format but still compress
        switch (metadata.format) {
          case 'jpeg':
            outputFormat = 'jpeg';
            outputExtension = '.jpg';
            break;
          case 'png':
            outputFormat = 'png';
            outputExtension = '.png';
            break;
          default:
            // Convert unknown formats to WebP
            break;
        }
      }

      // Apply format-specific compression
      let outputBuffer: Buffer;
      switch (outputFormat) {
        case 'webp':
          outputBuffer = await pipeline
            .webp({
              quality: config.quality,
              effort: 4, // Balance between speed and compression
            })
            .toBuffer();
          break;
        case 'jpeg':
          outputBuffer = await pipeline
            .jpeg({
              quality: config.quality,
              mozjpeg: true, // Better compression
            })
            .toBuffer();
          break;
        case 'png':
          outputBuffer = await pipeline
            .png({
              compressionLevel: 9,
              effort: 7,
            })
            .toBuffer();
          break;
      }

      // If still too large and not already at minimum quality, try more aggressive compression
      if (outputBuffer.length > config.maxSizeBytes && config.quality > 50) {
        this.logger?.debug('Output still too large, trying more aggressive compression', {
          filename,
          currentSize: outputBuffer.length,
          targetSize: config.maxSizeBytes,
        });

        // Try with lower quality
        const aggressiveQuality = Math.max(50, config.quality - 20);
        pipeline = sharp(Buffer.from(content));

        if (needsResize) {
          pipeline = pipeline.resize(config.maxWidth, config.maxHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }

        // Force WebP for best compression
        outputBuffer = await pipeline
          .webp({
            quality: aggressiveQuality,
            effort: 6,
          })
          .toBuffer();

        outputFormat = 'webp';
        outputExtension = '.webp';

        this.logger?.debug('Aggressive compression applied', {
          filename,
          quality: aggressiveQuality,
          newSize: outputBuffer.length,
        });
      }

      // Get final dimensions
      const finalMetadata = await sharp(outputBuffer).metadata();

      // Build optimized filename
      const baseName = this.getBaseName(filename);
      const optimizedFilename = baseName + outputExtension;

      const duration = Date.now() - startTime;
      const compressionRatio = ((1 - outputBuffer.length / originalSize) * 100).toFixed(1);

      this.logger?.info('Image optimized', {
        filename,
        optimizedFilename,
        originalSize,
        optimizedSize: outputBuffer.length,
        compressionRatio: `${compressionRatio}%`,
        format: outputFormat,
        dimensions: `${finalMetadata.width}x${finalMetadata.height}`,
        durationMs: duration,
      });

      return {
        data: new Uint8Array(outputBuffer),
        format: outputFormat,
        originalFilename: filename,
        optimizedFilename,
        originalSize,
        optimizedSize: outputBuffer.length,
        width: finalMetadata.width ?? 0,
        height: finalMetadata.height ?? 0,
        wasOptimized: true,
      };
    } catch (error) {
      this.logger?.error('Failed to optimize image, returning original', {
        filename,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.createResult(content, filename, originalSize, false);
    }
  }

  private createResult(
    content: Uint8Array,
    filename: string,
    originalSize: number,
    wasOptimized: boolean
  ): OptimizedImage {
    return {
      data: content,
      format: this.getExtension(filename).replace('.', ''),
      originalFilename: filename,
      optimizedFilename: filename,
      originalSize,
      optimizedSize: content.length,
      width: 0,
      height: 0,
      wasOptimized,
    };
  }

  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.slice(lastDot);
  }

  private getBaseName(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? filename : filename.slice(0, lastDot);
  }
}

/**
 * No-op implementation that passes through images unchanged.
 * Use when image optimization is disabled.
 */
export class NoopImageOptimizer implements ImageOptimizerPort {
  private readonly config: ImageOptimizationConfig = {
    ...DEFAULT_CONFIG,
    enabled: false,
  };

  getConfig(): ImageOptimizationConfig {
    return { ...this.config };
  }

  isOptimizable(_filename: string): boolean {
    return false;
  }

  async optimize(content: Uint8Array, filename: string): Promise<OptimizedImage> {
    return {
      data: content,
      format: filename.split('.').pop() ?? 'unknown',
      originalFilename: filename,
      optimizedFilename: filename,
      originalSize: content.length,
      optimizedSize: content.length,
      width: 0,
      height: 0,
      wasOptimized: false,
    };
  }
}
