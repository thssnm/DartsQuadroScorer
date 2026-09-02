export interface GistConfig {
  token: string;
  gistId: string;
}

const GIST_CONFIG_KEY = "darts-quadro-scorer:gist-config";

export const emptyGistConfig = (): GistConfig => ({ token: "", gistId: "" });

export const loadGistConfig = (): GistConfig => {
  try {
    const raw = window.localStorage.getItem(GIST_CONFIG_KEY);
    if (!raw) return emptyGistConfig();
    const parsed = JSON.parse(raw) as Partial<GistConfig>;
    return {
      token: typeof parsed.token === "string" ? parsed.token : "",
      gistId: typeof parsed.gistId === "string" ? parsed.gistId : "",
    };
  } catch {
    return emptyGistConfig();
  }
};

export const saveGistConfig = (config: GistConfig): void => {
  try {
    window.localStorage.setItem(
      GIST_CONFIG_KEY,
      JSON.stringify({ token: config.token.trim(), gistId: config.gistId.trim() })
    );
  } catch {
    // Die Gist-Anbindung ist optional und darf den Scorer nicht stören.
  }
};

export const isGistConfigComplete = (config: GistConfig): boolean =>
  config.token.trim().length > 0 && config.gistId.trim().length > 0;
