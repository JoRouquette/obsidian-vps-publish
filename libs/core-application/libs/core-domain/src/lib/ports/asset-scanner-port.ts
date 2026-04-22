/**
 * Port for scanning asset content for malicious code/viruses.
 * Scans assets BEFORE storage to prevent malware uploads.
 */
export interface AssetScannerPort {
  /**
   * Scans asset content for malware/viruses.
   *
   * @param buffer The asset content to scan
   * @param filename The asset filename (for logging/context)
   * @returns Scan result indicating if the file is safe
   * @throws {AssetScanError} if a virus/malware is detected
   */
  scan(buffer: Buffer | Uint8Array, filename: string): Promise<AssetScanResult>;
}

export interface AssetScanResult {
  /**
   * True if the file is clean (no threats detected)
   */
  isClean: boolean;

  /**
   * Name/signature of detected threat (if any)
   */
  threat?: string;

  /**
   * Additional scanner-specific metadata
   */
  metadata?: {
    scannerName: string;
    scanDurationMs?: number;
    [key: string]: unknown;
  };
}
