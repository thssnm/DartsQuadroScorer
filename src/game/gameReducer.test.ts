import { describe, expect, it } from "vitest";
import {
  START_SCORE,
  confirmedDarts,
  createInitialState,
  evaluateTurn,
  gameReducer,
  lastFilledSlotIndex,
  type GameAction,
} from "./gameReducer";
import { dartsInTurns } from "./dartCount";
import { computeHighlights } from "./highlights";
import { computePlayerStats } from "./stats";
import type { Dart, DartSlot, GameState, Multiplier, PlayerState, Turn } from "./types";
import { emptySlot } from "./types";

const dart = (segment: number, multiplier: Multiplier = 1): Dart => ({ segment, multiplier });
const miss = (): Dart => dart(0);
const slot = (segment: number, multiplier: Multiplier = 1): DartSlot => ({ segment, multiplier });
const turn = (scoreBefore: number, darts: Dart[], scoreAfter: number, bust = false): Turn => ({
  darts,
  scoreBefore,
  scoreAfter,
  bust,
});

const playingState = (legsToWin = 2): GameState => ({
  ...createInitialState("A", "B", legsToWin),
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

describe("evaluateTurn", () => {
  it("handles a normal turn without finish", () => {
    expect(evaluateTurn(100, [dart(20), dart(19), dart(18)])).toEqual({
      scoreAfter: 43,
      bust: false,
      legWon: false,
    });
  });

  it("busts when the remaining score would become negative", () => {
    expect(evaluateTurn(10, [dart(20)])).toEqual({
      scoreAfter: 10,
      bust: true,
      legWon: false,
    });
  });

  it("busts when the remaining score would become exactly 1", () => {
    expect(evaluateTurn(2, [dart(1)])).toEqual({
      scoreAfter: 2,
      bust: true,
      legWon: false,
    });
  });

  it("busts when reaching 0 without a double as the last real dart", () => {
    expect(evaluateTurn(40, [dart(20), dart(20)])).toEqual({
      scoreAfter: 40,
      bust: true,
      legWon: false,
    });
  });

  it("accepts a normal double finish", () => {
    expect(evaluateTurn(40, [dart(20, 2)])).toEqual({
      scoreAfter: 0,
      bust: false,
      legWon: true,
    });
  });

  it("accepts a bull-extra finish", () => {
    expect(evaluateTurn(50, [dart(25, 2)])).toEqual({
      scoreAfter: 0,
      bust: false,
      legWon: true,
    });
  });

  it("uses lastRealDartIndex when padded misses follow the finishing dart", () => {
    expect(evaluateTurn(40, [dart(10), dart(15, 2), miss()], 1)).toEqual({
      scoreAfter: 0,
      bust: false,
      legWon: true,
    });
  });
});

describe("slot confirmation helpers", () => {
  it("turns three empty slots into misses", () => {
    expect(confirmedDarts([emptySlot(), emptySlot(), emptySlot()])).toEqual([miss(), miss(), miss()]);
    expect(lastFilledSlotIndex([emptySlot(), emptySlot(), emptySlot()])).toBe(-1);
  });

  it("preserves an empty middle slot and returns the last filled slot", () => {
    const slots: [DartSlot, DartSlot, DartSlot] = [slot(20), emptySlot(), slot(12, 2)];

    expect(confirmedDarts(slots)).toEqual([dart(20), miss(), dart(12, 2)]);
    expect(lastFilledSlotIndex(slots)).toBe(2);
  });

  it("counts trailing empty slots for non-finishing turns", () => {
    expect(confirmedDarts([slot(20), slot(20, 2), emptySlot()])).toEqual([dart(20), dart(20, 2), miss()]);
  });

  it("returns index 2 when all slots are filled", () => {
    expect(lastFilledSlotIndex([slot(1), slot(2), slot(3)])).toBe(2);
  });
});

describe("slot input", () => {
  it("toggles an active multiplier back to single without clearing the segment", () => {
    let state = playingState();
    state = setSlot(state, 0, 20, 2);

    const result = reduce(state, { type: "SET_SLOT_MULTIPLIER", index: 0, multiplier: 2 });

    expect(result.currentSlots[0]).toEqual(slot(20));
  });

  it("keeps multiplier and segment entry independent within the same slot", () => {
    let state = playingState();
    state = reduce(state, { type: "SET_SLOT_MULTIPLIER", index: 0, multiplier: 3 });
    state = reduce(state, { type: "SET_SLOT_SEGMENT", index: 0, segment: 19 });

    expect(state.currentSlots[0]).toEqual(slot(19, 3));
  });

  it("preserves preselected multipliers when numbers are entered left to right afterwards", () => {
    let state = playingState();
    state = reduce(state, { type: "SET_SLOT_MULTIPLIER", index: 1, multiplier: 3 });
    state = reduce(state, { type: "SET_SLOT_MULTIPLIER", index: 2, multiplier: 4 });
    state = reduce(state, { type: "SET_SLOT_MULTIPLIER", index: 0, multiplier: 2 });

    expect(state.currentSlots).toEqual([
      { segment: null, multiplier: 2 },
      { segment: null, multiplier: 3 },
      { segment: null, multiplier: 4 },
    ]);

    state = reduce(state, { type: "SET_SLOT_SEGMENT", index: 0, segment: 1 });
    state = reduce(state, { type: "SET_SLOT_SEGMENT", index: 1, segment: 2 });
    state = reduce(state, { type: "SET_SLOT_SEGMENT", index: 2, segment: 3 });

    expect(state.currentSlots).toEqual([slot(1, 2), slot(2, 3), slot(3, 4)]);
  });
});

describe("CONFIRM_TURN", () => {
  it("reduces remaining and switches active player for a normal turn", () => {
    let state = playingState();
    state = setSlot(state, 0, 20);
    state = setSlot(state, 1, 19);
    state = setSlot(state, 2, 18);

    const result = reduce(state, { type: "CONFIRM_TURN" });

    expect(result.players[0].remaining).toBe(START_SCORE - 57);
    expect(result.players[0].turns).toHaveLength(1);
    expect(result.activePlayer).toBe(1);
  });

  it("keeps remaining unchanged on bust and still switches active player", () => {
    let state = withPlayer(playingState(), 0, { ...playingState().players[0], remaining: 10 });
    state = setSlot(state, 0, 20);

    const result = reduce(state, { type: "CONFIRM_TURN" });

    expect(result.players[0].remaining).toBe(10);
    expect(result.players[0].turns[0]?.bust).toBe(true);
    expect(result.players[0].turns[0]?.darts).toEqual([dart(20), miss(), miss()]);
    expect(result.activePlayer).toBe(1);
  });

  it("counts one filled slot as three darts when the leg continues", () => {
    let state = playingState();
    state = setSlot(state, 0, 20);

    const result = reduce(state, { type: "CONFIRM_TURN" });

    expect(result.players[0].turns[0]?.darts).toEqual([dart(20), miss(), miss()]);
  });

  it("counts two filled slots as three darts when the leg continues", () => {
    let state = playingState();
    state = setSlot(state, 0, 20);
    state = setSlot(state, 1, 20);

    const result = reduce(state, { type: "CONFIRM_TURN" });

    expect(result.players[0].turns[0]?.darts).toEqual([dart(20), dart(20), miss()]);
  });

  it("finishes a leg and moves turns to legHistory", () => {
    let state = withPlayer(playingState(), 0, { ...playingState().players[0], remaining: 40 });
    state = setSlot(state, 0, 20, 2);

    const result = reduce(state, { type: "CONFIRM_TURN" });

    expect(result.phase).toBe("leg-finished");
    expect(result.players[0].remaining).toBe(0);
    expect(result.players[0].legsWon).toBe(1);
    expect(result.players[0].turns).toEqual([]);
    expect(result.players[0].legHistory[0]?.won).toBe(true);
    expect(result.players[0].legHistory[0]?.turns[0]?.darts).toEqual([dart(20, 2)]);
  });

  it("counts a two-dart checkout when the second slot wins the leg", () => {
    let state = playingState();
    state = withPlayer(state, 0, { ...state.players[0], remaining: 60 });
    state = setSlot(state, 0, 20);
    state = setSlot(state, 1, 20, 2);

    const result = reduce(state, { type: "CONFIRM_TURN" });

    expect(result.players[0].legHistory[0]?.turns[0]?.darts).toEqual([dart(20), dart(20, 2)]);
  });

  it("counts a three-dart checkout when the third slot wins the leg", () => {
    let state = playingState();
    state = withPlayer(state, 0, { ...state.players[0], remaining: 80 });
    state = setSlot(state, 0, 20);
    state = setSlot(state, 1, 20);
    state = setSlot(state, 2, 20, 2);

    const result = reduce(state, { type: "CONFIRM_TURN" });

    expect(result.players[0].legHistory[0]?.turns[0]?.darts).toEqual([dart(20), dart(20), dart(20, 2)]);
  });

  it("finishes the match when the player reaches legsToWin", () => {
    let state = playingState(1);
    state = withPlayer(state, 0, { ...state.players[0], remaining: 40 });
    state = setSlot(state, 0, 20, 2);

    expect(reduce(state, { type: "CONFIRM_TURN" }).phase).toBe("match-finished");
  });

  it("records a two-dart checkout with the actual dart count for history, stats, and highlights", () => {
    let state = playingState(1);
    state = withPlayer(state, 0, {
      ...state.players[0],
      remaining: 100,
      turns: [
        turn(501, [dart(20, 4), dart(20, 4), dart(20, 4)], 261),
        turn(261, [dart(20, 4), dart(20, 4), dart(1)], 100),
      ],
    });
    state = setSlot(state, 0, 20, 3);
    state = setSlot(state, 1, 20, 2);

    const result = reduce(state, { type: "CONFIRM_TURN" });
    const wonLeg = result.players[0].legHistory[0];
    const stats = computePlayerStats(result.players[0]);

    expect(result.phase).toBe("match-finished");
    expect(wonLeg?.turns.at(-1)?.darts).toEqual([dart(20, 3), dart(20, 2)]);
    expect(wonLeg?.turns.reduce((sum, t) => sum + t.darts.length, 0)).toBe(8);
    expect(stats.bestLeg).toEqual({ darts: 8 });
    expect(stats.matchAverage).toBeCloseTo((501 / 8) * 3);
    expect(computeHighlights(result)).toContain("8 Darts (A)");
  });

  it("keeps a full-leg total at 10 darts when the final turn is a one-dart checkout", () => {
    let state = playingState(1);
    state = withPlayer(state, 0, {
      ...state.players[0],
      remaining: 40,
      turns: [
        turn(501, [dart(20, 3), dart(20, 3), dart(20, 3)], 321),
        turn(321, [dart(20, 4), dart(20, 3), miss()], 181),
        turn(181, [dart(20, 4), dart(20, 3), dart(1)], 40),
      ],
    });
    state = setSlot(state, 0, 20, 2);

    const result = reduce(state, { type: "CONFIRM_TURN" });
    const wonLeg = result.players[0].legHistory[0];
    const stats = computePlayerStats(result.players[0]);

    expect(wonLeg?.turns.at(-1)?.darts).toEqual([dart(20, 2)]);
    expect(dartsInTurns(wonLeg?.turns ?? [])).toBe(10);
    expect(stats.bestLeg).toEqual({ darts: 10 });
    expect(stats.matchAverage).toBeCloseTo((501 / 10) * 3);
    expect(computeHighlights(result)).toContain("10 Darts (A)");
  });
});

describe("CONFIRM_EDIT", () => {
  it("keeps a full-leg total at 10 darts after editing an earlier turn before a one-dart checkout", () => {
    let state = playingState(1);
    const player = {
      ...state.players[0],
      remaining: 0,
      turns: [
        turn(501, [dart(20, 3), dart(20, 3), dart(20, 3)], 321),
        turn(321, [dart(20, 4), dart(20, 3), miss()], 181),
        turn(181, [dart(20, 4), dart(20, 3), dart(1)], 40),
        turn(40, [dart(20, 2)], 0),
      ],
    };
    state = withPlayer(state, 0, player);
    state = reduce(state, { type: "EDIT_TURN", playerIndex: 0, turnIndex: 1 });
    state = reduce(state, { type: "CLEAR_SLOT", index: 0 });
    state = reduce(state, { type: "CLEAR_SLOT", index: 1 });
    state = reduce(state, { type: "CLEAR_SLOT", index: 2 });
    state = setSlot(state, 0, 20, 3);
    state = setSlot(state, 1, 20, 3);
    state = setSlot(state, 2, 20);

    const result = reduce(state, { type: "CONFIRM_EDIT" });
    const wonLeg = result.players[0].legHistory[0];
    const stats = computePlayerStats(result.players[0]);

    expect(result.phase).toBe("match-finished");
    expect(wonLeg?.turns.at(-1)?.darts).toEqual([dart(20, 2)]);
    expect(dartsInTurns(wonLeg?.turns ?? [])).toBe(10);
    expect(stats.bestLeg).toEqual({ darts: 10 });
    expect(stats.matchAverage).toBeCloseTo((501 / 10) * 3);
    expect(computeHighlights(result)).toContain("10 Darts (A)");
  });

  it("keeps a padded short checkout at its actual dart count after recalculating an earlier turn", () => {
    let state = playingState(1);
    const player = {
      ...state.players[0],
      remaining: 0,
      turns: [
        turn(501, [dart(20, 3), dart(20, 3), dart(20, 3)], 321),
        turn(321, [dart(20, 4), dart(20, 3), miss()], 181),
        turn(181, [dart(20, 4), dart(20), miss()], 81),
        turn(81, [dart(20, 3), dart(20, 3), dart(20, 3)], 81, true),
        turn(81, [dart(20), dart(20), dart(1)], 40),
        turn(40, [dart(20, 2), miss(), miss()], 0),
      ],
    };
    state = withPlayer(state, 0, player);
    state = reduce(state, { type: "EDIT_TURN", playerIndex: 0, turnIndex: 1 });
    state = reduce(state, { type: "CLEAR_SLOT", index: 0 });
    state = reduce(state, { type: "CLEAR_SLOT", index: 1 });
    state = reduce(state, { type: "CLEAR_SLOT", index: 2 });
    state = setSlot(state, 0, 20, 3);
    state = setSlot(state, 1, 20, 3);
    state = setSlot(state, 2, 20);

    const result = reduce(state, { type: "CONFIRM_EDIT" });
    const wonLeg = result.players[0].legHistory[0];
    const stats = computePlayerStats(result.players[0]);

    expect(result.phase).toBe("match-finished");
    expect(wonLeg?.turns.at(-1)?.darts).toEqual([dart(20, 2)]);
    expect(dartsInTurns(wonLeg?.turns ?? [])).toBe(16);
    expect(stats.bestLeg).toEqual({ darts: 16 });
    expect(stats.matchAverage).toBeCloseTo((501 / 16) * 3);
    expect(computeHighlights(result)).toContain("16 Darts (A)");
  });

  it("keeps following darts and recalculates the remaining score chain", () => {
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

    expect(result.players[0].remaining).toBe(10);
    expect(result.players[0].turns[1]?.darts).toEqual(player.turns[1]?.darts);
    expect(result.players[0].turns.map((t) => [t.scoreBefore, t.scoreAfter])).toEqual([
      [100, 20],
      [20, 10],
    ]);
  });

  it("rejects edits that make a following turn go below 0", () => {
    let state = playingState();
    const player = {
      ...state.players[0],
      remaining: 10,
      turns: [
        turn(100, [dart(20, 2), miss(), miss()], 60),
        turn(60, [dart(25, 2), miss(), miss()], 10),
      ],
    };
    state = withPlayer(state, 0, player);
    state = reduce(state, { type: "EDIT_TURN", playerIndex: 0, turnIndex: 0 });
    state = setSlot(state, 0, 20, 4);

    const result = reduce(state, { type: "CONFIRM_EDIT" });

    expect(result.editError).toBe("Diese Änderung würde eine spätere Aufnahme unmöglich machen.");
    expect(result.players[0].turns).toEqual(player.turns);
    expect(result.editingTurn).toEqual({ playerIndex: 0, turnIndex: 0 });
  });

  it("rejects edits that would finish the leg before the original last turn", () => {
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

    expect(result.editError).toBe("Diese Änderung würde das Leg vorzeitig beenden.");
    expect(result.players[0].turns).toEqual(player.turns);
  });

  it("closes the leg when the original last turn is edited to a valid finish", () => {
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

    expect(result.phase).toBe("leg-finished");
    expect(result.players[0].legsWon).toBe(1);
    expect(result.players[0].turns).toEqual([]);
    expect(result.players[0].legHistory[0]?.turns[0]?.darts).toEqual([dart(20, 2)]);
    expect(result.players[1].legHistory[0]?.won).toBe(false);
  });
});
