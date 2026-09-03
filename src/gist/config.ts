export interface GistConfig {
  token: string;
  gistId: string;
}

export const loadGistConfig = (): GistConfig => ({
  token: import.meta.env.VITE_GITHUB_TOKEN ?? "",
  gistId: import.meta.env.VITE_GITHUB_GIST_ID ?? "",
});

export const isGistConfigComplete = (config: GistConfig): boolean =>
  config.token.trim().length > 0 && config.gistId.trim().length > 0;
