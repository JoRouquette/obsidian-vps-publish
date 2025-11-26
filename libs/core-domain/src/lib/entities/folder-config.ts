import { SanitizationRules } from './sanitization-rules';

export interface FolderConfig {
  id: string;
  vaultFolder: string;
  routeBase: string;
  vpsId: string;

  sanitization?: SanitizationRules[];
}
