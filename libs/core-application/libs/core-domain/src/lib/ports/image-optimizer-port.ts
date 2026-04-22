/**
 * Result of image optimization
 */
export interface OptimizedImage {
  /** Optimized image data */
  data: Uint8Array;
  /** Final format (e.g., 'webp', 'jpeg', 'png') */
  format: string;
  /** Original filename (for reference) */
  originalFilename: string;
  /** New filename with correct extension */
  optimizedFilename: string;
  /** Original size in bytes */
  originalSize: number;
  /** Optimized size in bytes */
  optimizedSize: number;
  /** Width after optimization */
  width: number;
  /** Height after optimization */
  height: number;
  /** Whether the image was actually modified */
  wasOptimized: boolean;
}

/**
 * Configuration for image optimization
 */
export interface ImageOptimizationConfig {
  /** Enable/disable optimization (default: true) */
  enabled: boolean;
  /** Convert images to WebP format (default: true) */
  convertToWebp: boolean;
  /** Quality for lossy compression 1-100 (default: 85) */
  quality: number;
  /** Maximum width in pixels, larger images will be resized (default: 4096) */
  maxWidth: number;
  /** Maximum height in pixels, larger images will be resized (default: 4096) */
  maxHeight: number;
  /** Maximum file size in bytes, images larger will be compressed more aggressively */
  maxSizeBytes: number;
  /** Preserve original format instead of converting (for specific use cases) */
  preserveFormat: boolean;
}

/**
 * Port for image optimization service.
 * Implementations should handle image compression, format conversion, and resizing.
 */
export interface ImageOptimizerPort {
  /**
   * Optimize an image.
   * @param content - Raw image data
   * @param filename - Original filename (used to detect format)
   * @param config - Optional configuration overrides
   * @returns Optimized image data and metadata
   */
  optimize(
    content: Uint8Array,
    filename: string,
    config?: Partial<ImageOptimizationConfig>
  ): Promise<OptimizedImage>;

  /**
   * Check if a file is an optimizable image based on its filename/extension.
   * @param filename - Filename to check
   * @returns true if the file can be optimized
   */
  isOptimizable(filename: string): boolean;

  /**
   * Get the current configuration
   */
  getConfig(): ImageOptimizationConfig;
}
