import type { GameState } from "../game/types";
import {
  appendMatchToHistory,
  loadCurrentMatchHistoryId,
  saveCurrentMatchHistoryId,
  type MatchHistoryEntry,
} from "../game/persistence";
import { createMatchId, defaultBoardName, mapGameStateToResult } from "./matchResult";

// Schreibt das beendete Match in die lokale Historie - unabhängig davon, ob
// der Upload aktiviert ist und ob er klappt. Ein zweiter Aufruf für dasselbe
// Match (z.B. nach einem Reload) legt keinen weiteren Eintrag an, sondern
// liefert die ID des bestehenden zurück. matchId und Upload-Status ergänzt
// ensureApiHistoryFields.
export const recordFinishedMatch = (state: GameState, boardId: string): string => {
  const existingId = loadCurrentMatchHistoryId();
  if (existingId) return existingId;

  const entry: MatchHistoryEntry = {
    id: createMatchId(),
    ...mapGameStateToResult(state, defaultBoardName(boardId)),
  };

  appendMatchToHistory(entry);
  saveCurrentMatchHistoryId(entry.id);
  return entry.id;
};
