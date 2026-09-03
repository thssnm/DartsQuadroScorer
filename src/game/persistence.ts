import type { GameState } from "./types";

const STORAGE_KEY = "darts-quadro-scorer:game-state";
const DEVICE_ID_KEY = "darts-quadro-scorer:device-id";
const BOARD_ID_KEY = "darts-quadro-scorer:board-id";

export const DEFAULT_BOARD_ID = "Board 1";

const createDeviceId = (): string => {
  if (typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
};

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

export const getDeviceId = (): string => {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const deviceId = createDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  } catch {
    return createDeviceId();
  }
};

export const resetDeviceId = (): string => {
  const deviceId = createDeviceId();
  try {
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch {
    // siehe oben
  }
  return deviceId;
};

export const loadBoardId = (): string => {
  try {
    const boardId = window.localStorage.getItem(BOARD_ID_KEY)?.trim();
    return boardId || DEFAULT_BOARD_ID;
  } catch {
    return DEFAULT_BOARD_ID;
  }
};

export const saveBoardId = (boardId: string): void => {
  try {
    window.localStorage.setItem(BOARD_ID_KEY, boardId.trim());
  } catch {
    // siehe oben
  }
};

// Ein Spiel gilt als "fortsetzbar", wenn es über den Setup-Bildschirm
// hinaus ist. match-finished zählt bewusst mit, damit die Statistik-Seite
// nach einem Reload nicht verloren geht, bevor der Nutzer sie gesehen hat.
export const isResumableState = (state: GameState): boolean => state.phase !== "setup";
