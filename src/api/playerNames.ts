import { loadApiAuth, loadLocalPlayerNames } from "../game/persistence";
import { readPlayersFromApi } from "./client";

const sorted = (names: string[]): string[] => [...new Set(names)].sort();

// Spielerliste fürs Dropdown, alphabetisch (bewusst einfache String-
// Sortierung, keine Lokalisierung). Angemeldet: ausschließlich die
// players-Collection - fällt die API aus, bleibt das Dropdown leer, der
// Name lässt sich immer tippen. Ohne Anmeldung: die lokal gemerkten Namen
// der letzten Matches.
export const loadSetupPlayerNames = async (): Promise<string[]> => {
  const auth = loadApiAuth();
  if (!auth) return sorted(loadLocalPlayerNames());
  try {
    return sorted(await readPlayersFromApi(auth.token));
  } catch {
    return [];
  }
};
