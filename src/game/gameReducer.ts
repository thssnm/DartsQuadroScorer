import type { Dart, GameState, PlayerState } from "./types";
import { dartValue, isDoubleFinish, turnTotal } from "./types";

export const START_SCORE = 501;

export const createInitialPlayer = (name: string): PlayerState => ({
  name,
  remaining: START_SCORE,
  turns: [],
  legsWon: 0,
});

export const createInitialState = (
  nameA: string,
  nameB: string,
  legsToWin: number
): GameState => ({
  phase: "setup",
  players: [createInitialPlayer(nameA), createInitialPlayer(nameB)],
  activePlayer: 0,
  startingPlayer: 0,
  legsToWin,
  currentLegDarts: [],
});

export type GameAction =
  | { type: "START_MATCH" }
  | { type: "SWITCH_STARTING_PLAYER" }
  | { type: "ADD_DART"; dart: Dart }
  | { type: "REMOVE_LAST_DART" }
  | { type: "CONFIRM_TURN" }
  | { type: "FORCE_BUST" }
  | { type: "NEXT_LEG" }
  | { type: "RESET_MATCH"; nameA: string; nameB: string; legsToWin: number };

interface TurnOutcome {
  scoreAfter: number;
  bust: boolean;
  legWon: boolean;
}

// Berechnet das Ergebnis einer Aufnahme nach Double-Out-Regeln.
// Bust wenn: Rest < 0, Rest === 1, oder Rest === 0 aber letzter Dart kein Double.
export const evaluateTurn = (remaining: number, darts: Dart[]): TurnOutcome => {
  const thrown = turnTotal(darts);
  const newRemaining = remaining - thrown;
  const lastDart = darts[darts.length - 1];

  if (newRemaining < 0 || newRemaining === 1) {
    return { scoreAfter: remaining, bust: true, legWon: false };
  }
  if (newRemaining === 0) {
    if (lastDart && isDoubleFinish(lastDart)) {
      return { scoreAfter: 0, bust: false, legWon: true };
    }
    return { scoreAfter: remaining, bust: true, legWon: false };
  }
  return { scoreAfter: newRemaining, bust: false, legWon: false };
};

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case "RESET_MATCH": {
      return createInitialState(action.nameA, action.nameB, action.legsToWin);
    }

    case "SWITCH_STARTING_PLAYER": {
      if (state.phase !== "setup") return state;
      const newStarting = state.startingPlayer === 0 ? 1 : 0;
      return { ...state, startingPlayer: newStarting, activePlayer: newStarting };
    }

    case "START_MATCH": {
      return { ...state, phase: "playing" };
    }

    case "ADD_DART": {
      if (state.phase !== "playing") return state;
      if (state.currentLegDarts.length >= 3) return state;
      return { ...state, currentLegDarts: [...state.currentLegDarts, action.dart] };
    }

    case "REMOVE_LAST_DART": {
      if (state.currentLegDarts.length === 0) return state;
      return { ...state, currentLegDarts: state.currentLegDarts.slice(0, -1) };
    }

    case "CONFIRM_TURN": {
      if (state.phase !== "playing") return state;
      if (state.currentLegDarts.length === 0) return state;

      const activeIdx = state.activePlayer;
      const player = state.players[activeIdx];
      const outcome = evaluateTurn(player.remaining, state.currentLegDarts);

      const updatedPlayer: PlayerState = {
        ...player,
        remaining: outcome.scoreAfter,
        turns: [
          ...player.turns,
          {
            darts: state.currentLegDarts,
            scoreBefore: player.remaining,
            scoreAfter: outcome.scoreAfter,
            bust: outcome.bust,
          },
        ],
      };

      const players: [PlayerState, PlayerState] =
        activeIdx === 0 ? [updatedPlayer, state.players[1]] : [state.players[0], updatedPlayer];

      if (outcome.legWon) {
        const finishedPlayer: PlayerState = { ...updatedPlayer, legsWon: updatedPlayer.legsWon + 1 };
        const finalPlayers: [PlayerState, PlayerState] =
          activeIdx === 0 ? [finishedPlayer, state.players[1]] : [state.players[0], finishedPlayer];

        const matchWon = finishedPlayer.legsWon >= state.legsToWin;

        return {
          ...state,
          players: finalPlayers,
          currentLegDarts: [],
          phase: matchWon ? "match-finished" : "leg-finished",
        };
      }

      return {
        ...state,
        players,
        currentLegDarts: [],
        activePlayer: activeIdx === 0 ? 1 : 0,
      };
    }

    // Manueller Bust: die bereits eingegebenen Darts dieser Aufnahme zählen als
    // geworfen (für die Statistik), der Punktestand bleibt aber unverändert.
    case "FORCE_BUST": {
      if (state.phase !== "playing") return state;
      if (state.currentLegDarts.length === 0) return state;

      const activeIdx = state.activePlayer;
      const player = state.players[activeIdx];

      const updatedPlayer: PlayerState = {
        ...player,
        turns: [
          ...player.turns,
          {
            darts: state.currentLegDarts,
            scoreBefore: player.remaining,
            scoreAfter: player.remaining,
            bust: true,
          },
        ],
      };

      const players: [PlayerState, PlayerState] =
        activeIdx === 0 ? [updatedPlayer, state.players[1]] : [state.players[0], updatedPlayer];

      return {
        ...state,
        players,
        currentLegDarts: [],
        activePlayer: activeIdx === 0 ? 1 : 0,
      };
    }

    case "NEXT_LEG": {
      if (state.phase !== "leg-finished") return state;
      const nextStarting = state.startingPlayer === 0 ? 1 : 0;
      const resetPlayers: [PlayerState, PlayerState] = [
        { ...state.players[0], remaining: START_SCORE, turns: [] },
        { ...state.players[1], remaining: START_SCORE, turns: [] },
      ];
      return {
        ...state,
        players: resetPlayers,
        startingPlayer: nextStarting,
        activePlayer: nextStarting,
        currentLegDarts: [],
        phase: "playing",
      };
    }

    default:
      return state;
  }
};

export const dartsAsScore = (darts: Dart[]) => turnTotal(darts);
export { dartValue };
