import { readPlayersFromGist } from "./api";
import { isGistConfigComplete, type GistConfig } from "./config";

export const loadSetupPlayerNames = async (
  resultUploadEnabled: boolean,
  config: GistConfig
): Promise<string[]> => {
  if (!resultUploadEnabled || !isGistConfigComplete(config)) return [];

  try {
    const { players } = await readPlayersFromGist(config);
    // Im Gist stehen die Namen in der Reihenfolge, in der sie dazugekommen
    // sind - im Dropdown sollen sie alphabetisch stehen. Bewusst einfache
    // String-Sortierung, keine Lokalisierung.
    return [...players].sort();
  } catch {
    return [];
  }
};
