import { IdGeneratorPort } from '../../application/ports/IdGeneratorPort';

export class UuidIdGenerator implements IdGeneratorPort {
  generateId(): string {
    return crypto.randomUUID();
  }
}
