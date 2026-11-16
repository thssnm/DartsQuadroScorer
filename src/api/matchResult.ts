import type { GameState } from "../game/types";
import { computeHighlights } from "../game/highlights";
import { computePlayerStats } from "../game/stats";

// Das Ergebnis eines beendeten Matches, so wie es in der lokalen Historie
// liegt und an die API geht.
export interface MatchResult {
  boardName: string;
  home: string;
  guest: string;
  legsHome: number;
  legsGuest: number;
  averageHome?: number;
  averageGuest?: number;
  highlights: string[];
  updatedAt: string;
}

const fallbackMatchId = (): string => {
  const timestamp = new Date().toISOString().replace(/[^0-9A-Z]/gi, "");
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
};

export const createMatchId = (): string => globalThis.crypto?.randomUUID?.() ?? fallbackMatchId();

export const defaultBoardName = (boardId: string): string => boardId.trim() || "Board 1";

const roundedAverage = (average: number): number | undefined => {
  if (!Number.isFinite(average) || average <= 0) return undefined;
  return Math.round(average * 10) / 10;
};

export const mapGameStateToResult = (
  state: GameState,
  boardName: string,
  updatedAt: string = new Date().toISOString()
): MatchResult => {
  const averageHome = roundedAverage(computePlayerStats(state.players[0]).matchAverage);
  const averageGuest = roundedAverage(computePlayerStats(state.players[1]).matchAverage);
  return {
    boardName,
    home: state.players[0].name,
    guest: state.players[1].name,
    legsHome: state.players[0].legsWon,
    legsGuest: state.players[1].legsWon,
    ...(averageHome === undefined ? {} : { averageHome }),
    ...(averageGuest === undefined ? {} : { averageGuest }),
    highlights: computeHighlights(state),
    updatedAt,
  };
};
