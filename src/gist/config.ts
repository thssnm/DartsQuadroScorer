export interface GistConfig {
  token: string;
  gistId: string;
}

export const loadGistConfig = (gistId: string): GistConfig => ({
  token: import.meta.env.VITE_GITHUB_TOKEN ?? "",
  gistId,
});

export const isGistConfigComplete = (config: GistConfig): boolean =>
  config.token.trim().length > 0 && config.gistId.trim().length > 0;
