import type { GameState } from "./types";

const STORAGE_KEY = "darts-quadro-scorer:game-state";
const DEVICE_ID_KEY = "darts-quadro-scorer:device-id";
const BOARD_ID_KEY = "darts-quadro-scorer:board-id";
const GIST_ID_KEY = "darts-quadro-scorer:gist-id";
const RESULT_UPLOAD_ENABLED_KEY = "darts-quadro-scorer:result-upload-enabled";
const MATCH_UPLOADED_KEY = "darts-quadro-scorer:match-uploaded";
const MATCH_CONFIRMED_KEY = "darts-quadro-scorer:match-confirmed";
const MATCH_HISTORY_KEY = "darts-quadro-scorer:match-history";
const MATCH_HISTORY_ID_KEY = "darts-quadro-scorer:match-history-id";

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

export const loadGistId = (): string => {
  try {
    return window.localStorage.getItem(GIST_ID_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
};

export const saveGistId = (gistId: string): void => {
  try {
    window.localStorage.setItem(GIST_ID_KEY, gistId.trim());
  } catch {
    // siehe oben
  }
};

export const loadResultUploadEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(RESULT_UPLOAD_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
};

export const saveResultUploadEnabled = (enabled: boolean): void => {
  try {
    window.localStorage.setItem(RESULT_UPLOAD_ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    // siehe oben
  }
};

// Merkt sich, dass das Match-Ende-Popup mit "Weiter" bestätigt wurde.
// Damit ist das Match endgültig abgeschlossen: nach einem Reload führt das
// gespeicherte Match direkt zur Statistik, statt das Popup erneut zu
// zeigen - sonst käme über dessen "Rückgängig" eine Korrektur zustande,
// deren Ergebnis als zweite Datei im Gist landen würde. Anders als
// [loadMatchUploaded] hängt das Flag am Klick, nicht am Upload-Erfolg:
// bestätigt ist bestätigt, auch wenn Uploads abgeschaltet sind.
export const loadMatchConfirmed = (): boolean => {
  try {
    return window.localStorage.getItem(MATCH_CONFIRMED_KEY) === "true";
  } catch {
    return false;
  }
};

export const saveMatchConfirmed = (confirmed: boolean): void => {
  try {
    window.localStorage.setItem(MATCH_CONFIRMED_KEY, confirmed ? "true" : "false");
  } catch {
    // siehe oben
  }
};

// Merkt sich, dass das AKTUELL gespeicherte Match bereits erfolgreich
// hochgeladen wurde. Das Flag überlebt einen Reload - sonst würde ein
// zweites Bestätigen des Match-Ende-Popups dasselbe Ergebnis ein zweites
// Mal ins Gist schreiben. Es wird ausschließlich nach einem tatsächlich
// erfolgreichen Upload gesetzt und beim Start eines neuen Matches
// (Phase "setup") wieder gelöscht.
export const loadMatchUploaded = (): boolean => {
  try {
    return window.localStorage.getItem(MATCH_UPLOADED_KEY) === "true";
  } catch {
    return false;
  }
};

export const saveMatchUploaded = (uploaded: boolean): void => {
  try {
    window.localStorage.setItem(MATCH_UPLOADED_KEY, uploaded ? "true" : "false");
  } catch {
    // siehe oben
  }
};

// Ein Spiel gilt als "fortsetzbar", wenn es über den Setup-Bildschirm
// hinaus ist. match-finished zählt bewusst mit, damit die Statistik-Seite
// nach einem Reload nicht verloren geht, bevor der Nutzer sie gesehen hat.
export const isResumableState = (state: GameState): boolean => state.phase !== "setup";


// ---------- Lokale Match-Historie ----------
// Dauerhafte Liste aller beendeten Matches, unabhängig von [match-uploaded]
// und [match-confirmed]: die beiden Merker gehören zum laufenden Match und
// verfallen mit ihm, die Historie bleibt. Sie wird immer geschrieben, auch
// wenn der Upload abgeschaltet ist oder fehlschlägt - damit ein Ergebnis am
// Board nie nur im Gist existiert.

export type MatchHistoryUploadStatus = "uploaded" | "not-uploaded" | "upload-disabled";

// Dieselben Angaben, die auch ins Gist gehen, plus Status und eine lokale ID.
export interface MatchHistoryEntry {
  id: string;
  boardName: string;
  home: string;
  guest: string;
  legsHome: number;
  legsGuest: number;
  averageHome?: number;
  averageGuest?: number;
  highlights: string[];
  updatedAt: string;
  uploadStatus: MatchHistoryUploadStatus;
}

const isHistoryEntry = (value: unknown): value is MatchHistoryEntry =>
  typeof value === "object" && value !== null && typeof (value as MatchHistoryEntry).id === "string";

// Neueste zuerst - so steht das zuletzt gespielte Match oben in der Liste.
export const loadMatchHistory = (): MatchHistoryEntry[] => {
  try {
    const raw = window.localStorage.getItem(MATCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isHistoryEntry) : [];
  } catch {
    return [];
  }
};

const saveMatchHistory = (entries: MatchHistoryEntry[]): void => {
  try {
    window.localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Wie bei saveGameState: ein voller oder gesperrter localStorage darf
    // das laufende Spiel nicht stören.
  }
};

export const appendMatchToHistory = (entry: MatchHistoryEntry): void => {
  saveMatchHistory([entry, ...loadMatchHistory()]);
};

export const updateMatchHistoryStatus = (
  id: string,
  uploadStatus: MatchHistoryUploadStatus
): void => {
  const entries = loadMatchHistory();
  if (!entries.some((entry) => entry.id === id)) return;
  saveMatchHistory(entries.map((entry) => (entry.id === id ? { ...entry, uploadStatus } : entry)));
};

// ID des Historie-Eintrags, der zum laufenden Match gehört. Verhindert, dass
// ein Reload nach dem Bestätigen einen zweiten Eintrag anlegt, und erlaubt
// es, den Status desselben Eintrags nach einem Wiederholungsversuch zu
// aktualisieren. Verfällt mit dem Match (Phase "setup").
export const loadCurrentMatchHistoryId = (): string | null => {
  try {
    return window.localStorage.getItem(MATCH_HISTORY_ID_KEY);
  } catch {
    return null;
  }
};

export const saveCurrentMatchHistoryId = (id: string | null): void => {
  try {
    if (id === null) window.localStorage.removeItem(MATCH_HISTORY_ID_KEY);
    else window.localStorage.setItem(MATCH_HISTORY_ID_KEY, id);
  } catch {
    // siehe oben
  }
};
