import { loadApiAuth } from "../game/persistence";
import { readPlayersFromApi } from "./client";

// Spielerliste fürs Dropdown aus der players-Collection, alphabetisch.
// Bewusst einfache String-Sortierung, keine Lokalisierung. Fällt die API
// aus, bleibt das Dropdown leer - der Name lässt sich immer tippen.
export const loadSetupPlayerNames = async (resultUploadEnabled: boolean): Promise<string[]> => {
  if (!resultUploadEnabled) return [];
  try {
    const players = await readPlayersFromApi(loadApiAuth()?.token ?? null);
    return [...new Set(players)].sort();
  } catch {
    return [];
  }
};
