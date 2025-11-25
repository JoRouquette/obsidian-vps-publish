export interface UploaderPort {
  upload(toUpload: unknown[]): Promise<boolean>;
}
