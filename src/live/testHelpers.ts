import { createInitialState, gameReducer, type GameAction } from "../game/gameReducer";
import type { Dart, GameState, Multiplier, PlayerState, Turn } from "../game/types";

// Spielzustände für die Livescore-Tests, aufgebaut wie in gameReducer.test.ts.

export const dart = (segment: number, multiplier: Multiplier = 1): Dart => ({ segment, multiplier });

export const turn = (scoreBefore: number, darts: Dart[], scoreAfter: number): Turn => ({
  darts,
  scoreBefore,
  scoreAfter,
  bust: false,
});

export const reduce = (state: GameState, action: GameAction): GameState => gameReducer(state, action);

export const playingState = (legsToWin = 2): GameState => ({
  ...createInitialState("Alice", "Bob", legsToWin),
  phase: "playing",
});

export const withPlayer = (state: GameState, playerIndex: 0 | 1, player: PlayerState): GameState => ({
  ...state,
  players: playerIndex === 0 ? [player, state.players[1]] : [state.players[0], player],
});

export const setSlot = (state: GameState, index: number, segment: number, multiplier: Multiplier = 1): GameState => {
  let next = reduce(state, { type: "SET_SLOT_SEGMENT", index, segment });
  if (multiplier !== 1) next = reduce(next, { type: "SET_SLOT_MULTIPLIER", index, multiplier });
  return next;
};

// Bestätigt eine Aufnahme mit drei Darts.
export const throwTurn = (state: GameState, darts: [number, Multiplier?][]): GameState =>
  reduce(
    darts.reduce((next, [segment, multiplier], index) => setSlot(next, index, segment, multiplier), state),
    { type: "CONFIRM_TURN" }
  );

// Heim steht auf 40 und checkt mit D20 - bei legsToWin 1 ist das Match aus.
export const beforeCheckout = (legsToWin = 1): GameState => {
  let state = playingState(legsToWin);
  state = withPlayer(state, 0, {
    ...state.players[0],
    remaining: 40,
    turns: [
      turn(501, [dart(20, 4), dart(20, 4), dart(20, 4)], 261),
      turn(261, [dart(20, 4), dart(20, 4), dart(1)], 100),
      turn(100, [dart(20), dart(20), dart(20)], 40),
    ],
  });
  return withPlayer(state, 1, {
    ...state.players[1],
    remaining: 321,
    turns: [
      turn(501, [dart(20), dart(20), dart(20)], 441),
      turn(441, [dart(20), dart(20), dart(20)], 381),
      turn(381, [dart(20), dart(20), dart(20)], 321),
    ],
  });
};

export const checkout = (state: GameState): GameState =>
  reduce(setSlot(state, 0, 20, 2), { type: "CONFIRM_TURN" });
