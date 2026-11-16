import type { GameState } from "./types";

const STORAGE_KEY = "darts-quadro-scorer:game-state";
const DEVICE_ID_KEY = "darts-quadro-scorer:device-id";
const BOARD_ID_KEY = "darts-quadro-scorer:board-id";
const RESULT_UPLOAD_ENABLED_KEY = "darts-quadro-scorer:result-upload-enabled";
const MATCH_CONFIRMED_KEY = "darts-quadro-scorer:match-confirmed";
const MATCH_HISTORY_KEY = "darts-quadro-scorer:match-history";
const MATCH_HISTORY_ID_KEY = "darts-quadro-scorer:match-history-id";
const API_TOKEN_KEY = "darts-quadro-scorer:api-token";
const API_EMAIL_KEY = "darts-quadro-scorer:api-email";
const MATCH_UPLOADED_API_KEY = "darts-quadro-scorer:match-uploaded-api";
const LIVESCORE_ENABLED_KEY = "darts-quadro-scorer:livescore-enabled";
const LIVESCORE_SESSION_KEY = "darts-quadro-scorer:livescore-session";

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
// deren Ergebnis als zweiter Datensatz in der API landen würde. Anders als
// [loadMatchUploadedApi] hängt das Flag am Klick, nicht am Upload-Erfolg:
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
// Mal an die API schicken. Es wird ausschließlich nach einem tatsächlich
// erfolgreichen Upload gesetzt und beim Start eines neuen Matches
// (Phase "setup") wieder gelöscht. Der Schlüssel heißt aus der Zeit mit
// zwei Upload-Zielen "match-uploaded-api" - nicht umbenennen, sonst
// verlieren die Boards den Merker.
export const loadMatchUploadedApi = (): boolean => {
  try {
    return window.localStorage.getItem(MATCH_UPLOADED_API_KEY) === "true";
  } catch {
    return false;
  }
};

export const saveMatchUploadedApi = (uploaded: boolean): void => {
  try {
    window.localStorage.setItem(MATCH_UPLOADED_API_KEY, uploaded ? "true" : "false");
  } catch {
    // siehe oben
  }
};

// Anmeldung an der API: nur Token und E-Mail, das Passwort wird nie
// gespeichert.
export interface ApiAuth {
  token: string;
  email: string;
}

export const loadApiAuth = (): ApiAuth | null => {
  try {
    const token = window.localStorage.getItem(API_TOKEN_KEY);
    if (!token) return null;
    return { token, email: window.localStorage.getItem(API_EMAIL_KEY) ?? "" };
  } catch {
    return null;
  }
};

export const saveApiAuth = (auth: ApiAuth): void => {
  try {
    window.localStorage.setItem(API_TOKEN_KEY, auth.token);
    window.localStorage.setItem(API_EMAIL_KEY, auth.email);
  } catch {
    // siehe oben
  }
};

export const clearApiAuth = (): void => {
  try {
    window.localStorage.removeItem(API_TOKEN_KEY);
    window.localStorage.removeItem(API_EMAIL_KEY);
  } catch {
    // siehe oben
  }
};

// Ein Spiel gilt als "fortsetzbar", wenn es über den Setup-Bildschirm
// hinaus ist. match-finished zählt bewusst mit, damit die Statistik-Seite
// nach einem Reload nicht verloren geht, bevor der Nutzer sie gesehen hat.
export const isResumableState = (state: GameState): boolean => state.phase !== "setup";


// ---------- Lokale Match-Historie ----------
// Dauerhafte Liste aller beendeten Matches, unabhängig von
// [match-uploaded-api] und [match-confirmed]: die beiden Merker gehören zum
// laufenden Match und verfallen mit ihm, die Historie bleibt. Sie wird immer
// geschrieben, auch wenn der Upload abgeschaltet ist oder fehlschlägt -
// damit ein Ergebnis am Board nie nur in der API existiert.

// Status des API-Uploads. "not-logged-in": beim Match-Ende war kein Token da.
export type MatchHistoryApiStatus = "uploaded" | "not-uploaded" | "not-logged-in" | "upload-disabled";

// Dieselben Angaben, die auch an die API gehen, plus Status und eine lokale
// ID. Ältere Einträge tragen zusätzlich ein "uploadStatus"-Feld aus der Zeit
// des Gist-Uploads; es wird ignoriert.
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
  // Beide Felder fehlen bei Einträgen aus der Zeit vor dem API-Ziel.
  // matchId macht den API-Upload idempotent (Unique-Feld in PocketBase).
  matchId?: string;
  apiUploadStatus?: MatchHistoryApiStatus;
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

export const updateMatchHistoryEntry = (
  id: string,
  patch: Pick<Partial<MatchHistoryEntry>, "matchId" | "apiUploadStatus">
): void => {
  const entries = loadMatchHistory();
  if (!entries.some((entry) => entry.id === id)) return;
  saveMatchHistory(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
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

// ---------- Livescore ----------
// Der Livescore-Sender (src/live/) beobachtet nur. Seine Keys hängen weder
// am Spielzustand noch an den Upload-Merkern.

export const loadLiveScoreEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(LIVESCORE_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
};

export const saveLiveScoreEnabled = (enabled: boolean): void => {
  try {
    window.localStorage.setItem(LIVESCORE_ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    // siehe oben
  }
};

// liveMatchId des laufenden Matches und - sobald der erste POST durch ist -
// die id des Datensatzes in der livescore-Collection. Beides zusammen, damit
// eine id nie einem fremden Match zugeordnet wird.
export interface LiveScoreSession {
  matchId: string;
  recordId?: string;
}

export const loadLiveScoreSession = (): LiveScoreSession | null => {
  try {
    const raw = window.localStorage.getItem(LIVESCORE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LiveScoreSession> | null;
    if (!parsed || typeof parsed.matchId !== "string" || !parsed.matchId) return null;
    return typeof parsed.recordId === "string" && parsed.recordId
      ? { matchId: parsed.matchId, recordId: parsed.recordId }
      : { matchId: parsed.matchId };
  } catch {
    return null;
  }
};

export const saveLiveScoreSession = (session: LiveScoreSession | null): void => {
  try {
    if (session === null) window.localStorage.removeItem(LIVESCORE_SESSION_KEY);
    else window.localStorage.setItem(LIVESCORE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // siehe oben
  }
};
