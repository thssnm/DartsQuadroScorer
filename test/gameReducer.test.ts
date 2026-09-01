import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialState,
  evaluateTurn,
  gameReducer,
  type GameAction,
} from "../src/game/gameReducer.ts";
import type { Dart, GameState, Multiplier, PlayerState, Turn } from "../src/game/types.ts";

const dart = (segment: number, multiplier: Multiplier = 1): Dart => ({ segment, multiplier });
const miss = (): Dart => dart(0);
const turn = (scoreBefore: number, darts: Dart[], scoreAfter: number, bust = false): Turn => ({
  darts,
  scoreBefore,
  scoreAfter,
  bust,
});

const playingState = (): GameState => ({
  ...createInitialState("A", "B", 2),
  phase: "playing",
});

const withPlayer = (state: GameState, playerIndex: 0 | 1, player: PlayerState): GameState => ({
  ...state,
  players: playerIndex === 0 ? [player, state.players[1]] : [state.players[0], player],
});

const reduce = (state: GameState, action: GameAction): GameState => gameReducer(state, action);

const setSlot = (
  state: GameState,
  index: number,
  segment: number,
  multiplier: Multiplier = 1
): GameState => {
  let next = reduce(state, { type: "SET_SLOT_SEGMENT", index, segment });
  if (multiplier !== 1) {
    next = reduce(next, { type: "SET_SLOT_MULTIPLIER", index, multiplier });
  }
  return next;
};

test("evaluateTurn enforces double-out bust rules", () => {
  assert.deepEqual(evaluateTurn(40, [dart(20, 2)]), {
    scoreAfter: 0,
    bust: false,
    legWon: true,
  });
  assert.deepEqual(evaluateTurn(50, [dart(25, 2)]), {
    scoreAfter: 0,
    bust: false,
    legWon: true,
  });
  assert.deepEqual(evaluateTurn(40, [dart(20), dart(20)]), {
    scoreAfter: 40,
    bust: true,
    legWon: false,
  });
  assert.deepEqual(evaluateTurn(2, [dart(1)]), {
    scoreAfter: 2,
    bust: true,
    legWon: false,
  });
  assert.deepEqual(evaluateTurn(10, [dart(20)]), {
    scoreAfter: 10,
    bust: true,
    legWon: false,
  });
});

test("CONFIRM_TURN uses the last filled slot for one-dart double finishes", () => {
  let state = playingState();
  state = withPlayer(state, 0, { ...state.players[0], remaining: 40 });
  state = setSlot(state, 0, 20, 2);

  const result = reduce(state, { type: "CONFIRM_TURN" });

  assert.equal(result.phase, "leg-finished");
  assert.equal(result.players[0].legsWon, 1);
  assert.deepEqual(result.players[0].legHistory[0]?.turns[0]?.darts, [
    dart(20, 2),
    miss(),
    miss(),
  ]);
});

test("CONFIRM_TURN preserves empty slot positions while checking the real last dart", () => {
  let state = playingState();
  state = withPlayer(state, 0, { ...state.players[0], remaining: 32 });
  state = setSlot(state, 0, 8);
  state = setSlot(state, 2, 12, 2);

  const result = reduce(state, { type: "CONFIRM_TURN" });

  assert.equal(result.phase, "leg-finished");
  assert.deepEqual(result.players[0].legHistory[0]?.turns[0]?.darts, [
    dart(8),
    miss(),
    dart(12, 2),
  ]);
});

test("CONFIRM_EDIT recalculates following turns from the edited score", () => {
  let state = playingState();
  const player = {
    ...state.players[0],
    remaining: 70,
    turns: [
      turn(100, [dart(20), miss(), miss()], 80),
      turn(80, [dart(10), miss(), miss()], 70),
    ],
  };
  state = withPlayer(state, 0, player);
  state = reduce(state, { type: "EDIT_TURN", playerIndex: 0, turnIndex: 0 });
  state = setSlot(state, 0, 20, 4);

  const result = reduce(state, { type: "CONFIRM_EDIT" });

  assert.equal(result.players[0].remaining, 10);
  assert.equal(result.players[0].turns[0]?.scoreBefore, 100);
  assert.equal(result.players[0].turns[0]?.scoreAfter, 20);
  assert.equal(result.players[0].turns[1]?.scoreBefore, 20);
  assert.equal(result.players[0].turns[1]?.scoreAfter, 10);
});

test("CONFIRM_EDIT can close a leg when the edited last turn becomes a valid finish", () => {
  let state = playingState();
  const player = {
    ...state.players[0],
    remaining: 10,
    turns: [turn(40, [dart(10), dart(10), dart(10)], 10)],
  };
  state = withPlayer(state, 0, player);
  state = reduce(state, { type: "EDIT_TURN", playerIndex: 0, turnIndex: 0 });
  state = setSlot(state, 0, 20, 2);
  state = reduce(state, { type: "CLEAR_SLOT", index: 1 });
  state = reduce(state, { type: "CLEAR_SLOT", index: 2 });

  const result = reduce(state, { type: "CONFIRM_EDIT" });

  assert.equal(result.phase, "leg-finished");
  assert.equal(result.players[0].legsWon, 1);
  assert.equal(result.players[0].turns.length, 0);
  assert.equal(result.players[0].legHistory[0]?.won, true);
  assert.equal(result.players[1].legHistory[0]?.won, false);
  assert.deepEqual(result.players[0].legHistory[0]?.turns[0]?.darts, [
    dart(20, 2),
    miss(),
    miss(),
  ]);
});

test("CONFIRM_EDIT rejects an edited turn that would finish before later turns", () => {
  let state = playingState();
  const player = {
    ...state.players[0],
    remaining: 20,
    turns: [
      turn(40, [dart(10), miss(), miss()], 30),
      turn(30, [dart(10), miss(), miss()], 20),
    ],
  };
  state = withPlayer(state, 0, player);
  state = reduce(state, { type: "EDIT_TURN", playerIndex: 0, turnIndex: 0 });
  state = setSlot(state, 0, 20, 2);
  state = reduce(state, { type: "CLEAR_SLOT", index: 1 });
  state = reduce(state, { type: "CLEAR_SLOT", index: 2 });

  const result = reduce(state, { type: "CONFIRM_EDIT" });

  assert.equal(result.editError, "Diese Änderung würde das Leg vorzeitig beenden.");
  assert.deepEqual(result.players[0].turns, player.turns);
  assert.deepEqual(result.editingTurn, { playerIndex: 0, turnIndex: 0 });
});
