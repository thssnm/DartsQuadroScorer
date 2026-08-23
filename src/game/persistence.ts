import type { GameState } from "./types";

const STORAGE_KEY = "darts-quadro-scorer:game-state";

export const saveGameState = (state: GameState): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage kann fehlschlagen (Safari privater Modus, Speicher voll).
    // Persistenz ist ein Komfortfeature - ein Fehler hier darf das laufende
    // Spiel nicht stören.
  }
};

export const loadGameState = (): GameState | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
};

export const clearGameState = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // siehe oben
  }
};

// Ein Spiel gilt als "fortsetzbar", wenn es über den Setup-Bildschirm
// hinaus ist. match-finished zählt bewusst mit, damit die Statistik-Seite
// nach einem Reload nicht verloren geht, bevor der Nutzer sie gesehen hat.
export const isResumableState = (state: GameState): boolean => state.phase !== "setup";
