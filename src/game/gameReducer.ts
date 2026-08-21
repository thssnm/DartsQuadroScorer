import type { Dart, DartSlot, GameState, Multiplier, PlayerState, Turn } from "./types";
import { dartValue, emptySlot, isDoubleFinish, isSlotComplete, slotToDart, turnTotal } from "./types";

export const START_SCORE = 501;

export const createInitialPlayer = (name: string): PlayerState => ({
  name,
  remaining: START_SCORE,
  turns: [],
  legsWon: 0,
  legHistory: [],
});

const emptySlots = (): [DartSlot, DartSlot, DartSlot] => [emptySlot(), emptySlot(), emptySlot()];

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
  currentSlots: emptySlots(),
});

export type GameAction =
  | { type: "START_MATCH" }
  | { type: "SWITCH_STARTING_PLAYER" }
  | { type: "SET_SLOT_SEGMENT"; index: number; segment: number }
  | { type: "SET_SLOT_MULTIPLIER"; index: number; multiplier: Multiplier }
  | { type: "CLEAR_SLOT"; index: number }
  | { type: "CONFIRM_TURN" }
  | { type: "UNDO_LAST_TURN" }
  | { type: "NEXT_LEG" }
  | { type: "ABORT_MATCH" }
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

// Begrenzt den Multiplikator eines Slots je nach Segment: Bull (25) nur
// x1/x2, Miss (0) immer x1, normale Segmente x1-x4.
const clampMultiplier = (segment: number | null, multiplier: Multiplier): Multiplier => {
  if (segment === 0) return 1;
  if (segment === 25 && multiplier > 2) return 2;
  return multiplier;
};

// Wandelt die aktuellen Slots in Darts um.
// - Sind ALLE 3 Slots leer, gilt das als sofortiges Bestätigen ohne Eingabe
//   und wird als 0/0/0 gewertet (3 geworfene Fehlwürfe).
// - Sind 1-2 Slots befüllt und der Rest leer (z.B. Leg-Ende nach 2 Darts),
//   zählen NUR die tatsächlich eingegebenen Darts - kein Auffüllen mit 0.
//   Das ist wichtig für die Double-Out-Prüfung: der letzte eingegebene Dart
//   muss der letzte in der Liste bleiben, sonst würde ein automatisch
//   angehängter Fehlwurf ein gültiges Finish verdecken.
const confirmedDarts = (slots: [DartSlot, DartSlot, DartSlot]): Dart[] => {
  const filled = slots.filter(isSlotComplete).map((s) => slotToDart(s) as Dart);
  if (filled.length === 0) {
    return [
      { segment: 0, multiplier: 1 },
      { segment: 0, multiplier: 1 },
      { segment: 0, multiplier: 1 },
    ];
  }
  return filled;
};

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case "RESET_MATCH": {
      return createInitialState(action.nameA, action.nameB, action.legsToWin);
    }

    case "ABORT_MATCH": {
      return createInitialState(state.players[0].name, state.players[1].name, state.legsToWin);
    }

    case "SWITCH_STARTING_PLAYER": {
      if (state.phase !== "setup") return state;
      const newStarting = state.startingPlayer === 0 ? 1 : 0;
      return { ...state, startingPlayer: newStarting, activePlayer: newStarting };
    }

    case "START_MATCH": {
      return { ...state, phase: "playing" };
    }

    // Zahl für einen Slot setzen. Reihenfolge egal — kann vor oder nach dem
    // Multiplikator kommen. Der Slot muss noch keine Zahl haben, sonst wird
    // sie ersetzt (Korrektur).
    case "SET_SLOT_SEGMENT": {
      if (state.phase !== "playing") return state;
      const slot = state.currentSlots[action.index];
      if (!slot) return state;
      const newSlot: DartSlot = {
        segment: action.segment,
        multiplier: clampMultiplier(action.segment, slot.multiplier),
      };
      const currentSlots = state.currentSlots.map((s, i) =>
        i === action.index ? newSlot : s
      ) as [DartSlot, DartSlot, DartSlot];
      return { ...state, currentSlots };
    }

    // Multiplikator für einen Slot setzen/togglen. Kann auch gesetzt werden
    // bevor die Zahl feststeht (Multiplikator wird vorgemerkt).
    case "SET_SLOT_MULTIPLIER": {
      if (state.phase !== "playing") return state;
      const slot = state.currentSlots[action.index];
      if (!slot) return state;
      const nextMultiplier: Multiplier = slot.multiplier === action.multiplier ? 1 : action.multiplier;
      const newSlot: DartSlot = {
        segment: slot.segment,
        multiplier: clampMultiplier(slot.segment, nextMultiplier),
      };
      const currentSlots = state.currentSlots.map((s, i) =>
        i === action.index ? newSlot : s
      ) as [DartSlot, DartSlot, DartSlot];
      return { ...state, currentSlots };
    }

    case "CLEAR_SLOT": {
      if (state.phase !== "playing") return state;
      const currentSlots = state.currentSlots.map((s, i) =>
        i === action.index ? emptySlot() : s
      ) as [DartSlot, DartSlot, DartSlot];
      return { ...state, currentSlots };
    }

    case "CONFIRM_TURN": {
      if (state.phase !== "playing") return state;
      const darts = confirmedDarts(state.currentSlots);

      const activeIdx = state.activePlayer;
      const player = state.players[activeIdx];
      const outcome = evaluateTurn(player.remaining, darts);
      const turn: Turn = {
        darts,
        scoreBefore: player.remaining,
        scoreAfter: outcome.scoreAfter,
        bust: outcome.bust,
      };

      const updatedPlayer: PlayerState = {
        ...player,
        remaining: outcome.scoreAfter,
        turns: [...player.turns, turn],
      };

      const players: [PlayerState, PlayerState] =
        activeIdx === 0 ? [updatedPlayer, state.players[1]] : [state.players[0], updatedPlayer];

      if (outcome.legWon) {
        const finishedPlayer: PlayerState = {
          ...updatedPlayer,
          legsWon: updatedPlayer.legsWon + 1,
          legHistory: [...updatedPlayer.legHistory, { turns: updatedPlayer.turns, won: true }],
          turns: [],
        };
        const otherIdx: 0 | 1 = activeIdx === 0 ? 1 : 0;
        const otherPlayer = state.players[otherIdx];
        const finishedOther: PlayerState = {
          ...otherPlayer,
          legHistory: [...otherPlayer.legHistory, { turns: otherPlayer.turns, won: false }],
          turns: [],
        };
        const finalPlayers: [PlayerState, PlayerState] =
          activeIdx === 0 ? [finishedPlayer, finishedOther] : [finishedOther, finishedPlayer];

        const matchWon = finishedPlayer.legsWon >= state.legsToWin;

        return {
          ...state,
          players: finalPlayers,
          currentSlots: emptySlots(),
          phase: matchWon ? "match-finished" : "leg-finished",
        };
      }

      return {
        ...state,
        players,
        currentSlots: emptySlots(),
        activePlayer: activeIdx === 0 ? 1 : 0,
      };
    }

    // Korrigiert die zuletzt bestätigte Aufnahme: die Aufnahme wird aus der Historie entfernt, der Punktestand des
    // betroffenen Spielers zurückgesetzt, die Darts wandern zurück in die
    // aktuelle Eingabe, damit sie neu eingegeben werden können.
    case "UNDO_LAST_TURN": {
      if (state.phase !== "playing") return state;
      const lastPlayerIdx: 0 | 1 = state.activePlayer === 0 ? 1 : 0;
      const player = state.players[lastPlayerIdx];
      if (player.turns.length === 0) return state;
      const hasPendingInput = state.currentSlots.some((s) => s.segment !== null);
      if (hasPendingInput) return state; // erst laufende Eingabe klären

      const lastTurn = player.turns[player.turns.length - 1];
      const updatedPlayer: PlayerState = {
        ...player,
        remaining: lastTurn.scoreBefore,
        turns: player.turns.slice(0, -1),
      };

      const players: [PlayerState, PlayerState] =
        lastPlayerIdx === 0 ? [updatedPlayer, state.players[1]] : [state.players[0], updatedPlayer];

      const restoredSlots = emptySlots();
      lastTurn.darts.forEach((d, i) => {
        if (i < 3) restoredSlots[i] = { segment: d.segment, multiplier: d.multiplier };
      });

      return {
        ...state,
        players,
        activePlayer: lastPlayerIdx,
        currentSlots: restoredSlots,
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
        currentSlots: emptySlots(),
        phase: "playing",
      };
    }

    default:
      return state;
  }
};

export const dartsAsScore = (darts: Dart[]) => turnTotal(darts);
export { dartValue };
