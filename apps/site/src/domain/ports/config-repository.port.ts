export interface PublicConfig {
  baseUrl: string;
  siteName: string;
  author: string;
  repoUrl: string;
  reportIssuesUrl: string;
  homeWelcomeTitle: string;
  /** Site locale for HTML lang attribute and i18n */
  locale: 'en' | 'fr';
  adminApiPath: string;
  adminDashboardEnabled: boolean;
}

export interface ConfigRepository {
  load(): Promise<PublicConfig>;
}
