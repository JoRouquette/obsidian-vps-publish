export interface PublicConfig {
  siteName: string;
  author: string;
  repoUrl: string;
  reportIssuesUrl: string;
  homeWelcomeTitle: string;
}

export interface ConfigRepository {
  load(): Promise<PublicConfig>;
}
