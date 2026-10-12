import { loadApiAuth } from "../game/persistence";
import type { GistConfig } from "../gist/config";
import { loadSetupPlayerNames } from "../gist/playerNames";
import { readPlayersFromApi } from "./client";

const loadApiPlayerNames = async (): Promise<string[]> => {
  try {
    return await readPlayersFromApi(loadApiAuth()?.token ?? null);
  } catch {
    return [];
  }
};

// Spielerliste fürs Dropdown aus Gist und API. Fällt eine Quelle aus, bleibt
// die andere nutzbar; der Online-Schalter gilt für beide.
export const loadAllSetupPlayerNames = async (
  resultUploadEnabled: boolean,
  config: GistConfig
): Promise<string[]> => {
  if (!resultUploadEnabled) return [];
  const [gistPlayers, apiPlayers] = await Promise.all([
    loadSetupPlayerNames(resultUploadEnabled, config),
    loadApiPlayerNames(),
  ]);
  return [...new Set([...gistPlayers, ...apiPlayers])].sort();
};
