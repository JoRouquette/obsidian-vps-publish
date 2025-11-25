import { SanitizationRules } from './SanitizationRules';

export interface FolderConfig {
  id: string;
  vaultFolder: string;
  routeBase: string;
  vpsId: string;

  sanitization?: SanitizationRules;
}
