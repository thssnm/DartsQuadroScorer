import type { GameState } from "../game/types";
import {
  loadApiAuth,
  loadCurrentMatchHistoryId,
  loadLiveScoreSession,
  loadMatchHistory,
  loadMatchUploadedApi,
  saveApiAuth,
  saveMatchUploadedApi,
  updateMatchHistoryEntry,
  type MatchHistoryApiStatus,
  type MatchHistoryEntry,
} from "../game/persistence";
import { createMatchId, defaultBoardName, mapGameStateToResult, type MatchResult } from "./matchResult";
import type { MatchUploadOutcome, UploadFailure, UploadFlowState } from "./uploadFlow";
import {
  ApiHttpError,
  addPlayersBestEffort,
  createResultRecord,
  isDuplicateMatchError,
  refreshAuth,
} from "./client";

// network = fetch kam nicht durch (der typische WLAN-Abbruch), http = die
// API hat abgelehnt.
export const classifyApiUploadError = (error: unknown): UploadFailure => {
  if (error instanceof ApiHttpError) {
    return { kind: "http", status: error.status, message: error.message };
  }
  if (error instanceof TypeError) {
    return { kind: "network", message: error.message };
  }
  return { kind: "unknown", message: error instanceof Error ? error.message : String(error) };
};

export const describeApiUploadFailure = (failure: UploadFailure): string => {
  switch (failure.kind) {
    case "network":
      return "Netzwerkfehler: keine Verbindung zur API (WLAN prüfen).";
    case "config":
      return "Nicht an der API angemeldet: in den Einstellungen anmelden.";
    case "http":
      if (failure.status === 401) {
        return "API-Anmeldung abgelaufen (401): in den Einstellungen neu anmelden.";
      }
      return `API-Fehler (${failure.status ?? "?"}): ${failure.message}`;
    default:
      return `Unbekannter Fehler: ${failure.message}`;
  }
};

export type ApiResultSource = MatchResult;

const findHistoryEntry = (id: string): MatchHistoryEntry | undefined =>
  loadMatchHistory().find((entry) => entry.id === id);

// Hat der Livescore-Sender für das laufende Match schon eine matchId
// vergeben, bekommt das Ergebnis dieselbe. Ohne Sender: neue UUID wie bisher.
const newMatchIdForCurrentMatch = (): string => loadLiveScoreSession()?.matchId ?? createMatchId();

// Ergänzt einen Historie-Eintrag um die API-Felder. Idempotent: eine schon
// vergebene matchId und ein schon gesetzter Status bleiben stehen - sonst
// bekäme ein Retry nach einem Reload eine neue ID und die Unique-Sperre in
// PocketBase griffe nicht mehr.
export const ensureApiHistoryFields = (
  id: string,
  initialStatus: MatchHistoryApiStatus = "not-uploaded"
): string => {
  const entry = findHistoryEntry(id);
  if (!entry) return createMatchId();
  // Die liveMatchId nur für den Eintrag des laufenden Matches - nie für ein
  // altes Ergebnis aus der Historie.
  const matchId =
    entry.matchId ?? (id === loadCurrentMatchHistoryId() ? newMatchIdForCurrentMatch() : createMatchId());
  if (!entry.matchId || !entry.apiUploadStatus) {
    updateMatchHistoryEntry(id, { matchId, apiUploadStatus: entry.apiUploadStatus ?? initialStatus });
  }
  return matchId;
};

// Refresh vor jedem Upload: prüft das Token und verlängert es.
const uploadResult = async (source: ApiResultSource, matchId: string): Promise<MatchUploadOutcome> => {
  const auth = loadApiAuth();
  if (!auth) return { result: "skipped" };

  try {
    const refreshed = await refreshAuth(auth.token, auth.email);
    saveApiAuth(refreshed);
    try {
      await createResultRecord(refreshed.token, {
        matchId,
        boardName: source.boardName,
        home: source.home,
        guest: source.guest,
        legsHome: source.legsHome,
        legsGuest: source.legsGuest,
        averageHome: source.averageHome,
        averageGuest: source.averageGuest,
        highlights: source.highlights,
        playedAt: source.updatedAt,
      });
    } catch (error) {
      if (!isDuplicateMatchError(error)) throw error;
    }
    void addPlayersBestEffort(refreshed.token, [source.home, source.guest]);
    return { result: "uploaded" };
  } catch (error) {
    const failure = classifyApiUploadError(error);
    console.error("[darts] API-Upload fehlgeschlagen:", describeApiUploadFailure(failure), failure);
    return { result: "failed", failure };
  }
};

interface ApiMatchUploadOptions {
  enabled: boolean;
  boardId: string;
  state: GameState;
  historyEntryId: string | null;
}

// Lädt das Ergebnis höchstens einmal pro Match hoch. Der Merker
// [match-uploaded-api] liegt im localStorage, greift also auch nach einem
// Reload. Gesetzt wird er nur nach einem erfolgreichen Upload - ein
// fehlgeschlagener Versuch (Netzwerk, Token) bleibt wiederholbar.
export const uploadApiMatchResultOnce = async ({
  enabled,
  boardId,
  state,
  historyEntryId,
}: ApiMatchUploadOptions): Promise<MatchUploadOutcome> => {
  if (!enabled || !loadApiAuth()) return { result: "skipped" };
  if (loadMatchUploadedApi()) return { result: "already-uploaded" };

  const entry = historyEntryId ? findHistoryEntry(historyEntryId) : undefined;
  const matchId = historyEntryId ? ensureApiHistoryFields(historyEntryId) : newMatchIdForCurrentMatch();
  const source = entry ?? mapGameStateToResult(state, defaultBoardName(boardId));

  const outcome = await uploadResult(source, matchId);
  if (outcome.result === "uploaded") {
    saveMatchUploadedApi(true);
    if (historyEntryId) updateMatchHistoryEntry(historyEntryId, { apiUploadStatus: "uploaded" });
  }
  return outcome;
};

// Führt einen Upload-Versuch aus und meldet jeden Zustandswechsel. "pending"
// wird synchron gemeldet, bevor der Request überhaupt startet - zwischen dem
// Klick auf "Weiter zur Statistik" und der Sperre liegt damit kein Moment,
// in dem "Neues Match" offen wäre.
export const runApiUploadFlow = async (
  options: ApiMatchUploadOptions,
  onState: (state: UploadFlowState) => void
): Promise<UploadFlowState> => {
  onState({ phase: "pending", failure: null });

  const outcome = await uploadApiMatchResultOnce(options);
  const next: UploadFlowState =
    outcome.result === "failed"
      ? { phase: "failed", failure: outcome.failure ?? null }
      : { phase: "done", failure: null };

  onState(next);
  return next;
};

export interface ApiHistoryUploadOutcome {
  uploaded: boolean;
  failure?: UploadFailure;
}

// Nachträglicher Upload aus der Historie. Dieselbe matchId wie beim Upload
// direkt nach dem Match - mehrfaches Klicken legt dank Unique-Feld keinen
// zweiten Datensatz an.
export const uploadHistoryEntryToApi = async (entry: MatchHistoryEntry): Promise<ApiHistoryUploadOutcome> => {
  if (!loadApiAuth()) {
    return { uploaded: false, failure: { kind: "config", message: "Nicht angemeldet" } };
  }
  const matchId = ensureApiHistoryFields(entry.id);
  const outcome = await uploadResult(entry, matchId);
  if (outcome.result !== "uploaded") return { uploaded: false, failure: outcome.failure };
  updateMatchHistoryEntry(entry.id, { apiUploadStatus: "uploaded" });
  return { uploaded: true };
};
