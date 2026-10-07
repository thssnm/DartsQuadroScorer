import type { GameState } from "../game/types";
import {
  appendMatchToHistory,
  loadCurrentMatchHistoryId,
  saveCurrentMatchHistoryId,
  updateMatchHistoryStatus,
  type MatchHistoryEntry,
  type MatchHistoryUploadStatus,
} from "../game/persistence";
import {
  createMatchFileId,
  defaultBoardName,
  mapGameStateToBoardFile,
  uploadFinishedMatchToGist,
} from "./api";
import { isGistConfigComplete, type GistConfig } from "./config";
import { classifyUploadError, describeUploadFailure, type UploadFailure } from "./matchUpload";

// Schreibt das beendete Match in die lokale Historie - unabhängig davon, ob
// der Upload aktiviert ist und ob er klappt. Ein zweiter Aufruf für dasselbe
// Match (z.B. nach einem Reload) legt keinen weiteren Eintrag an, sondern
// liefert die ID des bestehenden zurück.
export const recordFinishedMatch = (
  state: GameState,
  boardId: string,
  uploadEnabled: boolean
): string => {
  const existingId = loadCurrentMatchHistoryId();
  if (existingId) return existingId;

  const board = mapGameStateToBoardFile(state, defaultBoardName(boardId));
  const entry: MatchHistoryEntry = {
    id: createMatchFileId(),
    boardName: board.boardName,
    home: board.home,
    guest: board.guest,
    legsHome: board.legsHome,
    legsGuest: board.legsGuest,
    ...(board.averageHome === undefined ? {} : { averageHome: board.averageHome }),
    ...(board.averageGuest === undefined ? {} : { averageGuest: board.averageGuest }),
    highlights: board.highlights,
    updatedAt: board.updatedAt,
    uploadStatus: uploadEnabled ? "not-uploaded" : "upload-disabled",
  };

  appendMatchToHistory(entry);
  saveCurrentMatchHistoryId(entry.id);
  return entry.id;
};

export const setMatchHistoryStatus = (id: string, status: MatchHistoryUploadStatus): void =>
  updateMatchHistoryStatus(id, status);

export interface HistoryUploadOutcome {
  uploaded: boolean;
  failure?: UploadFailure;
}

// Nachträglicher Upload eines Eintrags aus der Historie. Benutzt denselben
// Request und dieselbe Fehlerklassifikation wie der Upload direkt nach dem
// Match; der Merker [match-uploaded] bleibt außen vor, weil er zum laufenden
// Match gehört und nicht zu einem Ergebnis aus der Vergangenheit.
export const uploadHistoryEntry = async (
  entry: MatchHistoryEntry,
  config: GistConfig
): Promise<HistoryUploadOutcome> => {
  if (!isGistConfigComplete(config)) {
    const failure: UploadFailure = { kind: "config", message: "Gist-Konfiguration unvollständig" };
    console.error("[darts] Nachträglicher Upload fehlgeschlagen:", describeUploadFailure(failure));
    return { uploaded: false, failure };
  }

  try {
    await uploadFinishedMatchToGist(config, entry.boardName, {
      boardName: entry.boardName,
      home: entry.home,
      guest: entry.guest,
      legsHome: entry.legsHome,
      legsGuest: entry.legsGuest,
      ...(entry.averageHome === undefined ? {} : { averageHome: entry.averageHome }),
      ...(entry.averageGuest === undefined ? {} : { averageGuest: entry.averageGuest }),
      status: "finished",
      highlights: entry.highlights,
      updatedAt: entry.updatedAt,
      acknowledged: false,
    });
    updateMatchHistoryStatus(entry.id, "uploaded");
    return { uploaded: true };
  } catch (error) {
    const failure = classifyUploadError(error);
    console.error(
      "[darts] Nachträglicher Upload fehlgeschlagen:",
      describeUploadFailure(failure),
      failure
    );
    return { uploaded: false, failure };
  }
};
