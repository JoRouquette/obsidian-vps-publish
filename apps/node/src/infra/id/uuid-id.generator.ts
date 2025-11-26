import { IdGeneratorPort } from '@core-application';

export class UuidIdGenerator implements IdGeneratorPort {
  generateId(): string {
    return crypto.randomUUID();
  }
}
