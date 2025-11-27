import { GuidGeneratorPort } from '@core-domain/ports/guid-generator-port';

export class GuidGeneratorAdapter implements GuidGeneratorPort {
  generateGuid(): string {
    return crypto.randomUUID();
  }
}
