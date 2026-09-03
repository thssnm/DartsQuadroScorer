import { readPlayersFromGist } from "./api";
import { isGistConfigComplete, type GistConfig } from "./config";

export const loadSetupPlayerNames = async (
  resultUploadEnabled: boolean,
  config: GistConfig
): Promise<string[]> => {
  if (!resultUploadEnabled || !isGistConfigComplete(config)) return [];

  try {
    const { players } = await readPlayersFromGist(config);
    return players;
  } catch {
    return [];
  }
};
