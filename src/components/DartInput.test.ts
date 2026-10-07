import { describe, expect, it } from "vitest";
import {
  canUseMultiplierControls,
  canUseSlotControls,
  getActiveSlotIndex,
  getRunningInputUndoTarget,
} from "./dartInputOrder";
import { createInitialState, gameReducer } from "../game/gameReducer";
import type { DartSlot, GameState, Multiplier } from "../game/types";
import { emptySlot } from "../game/types";

const slot = (segment: number, multiplier: Multiplier = 1): DartSlot => ({ segment, multiplier });

// Laufende Aufnahme mit drei eingetragenen Darts (60/60/60).
const turnInProgress = (): GameState => {
  const initial = createInitialState("A", "B", 1);
  let state: GameState = { ...initial, phase: "playing" };
  for (const index of [0, 1, 2]) {
    state = gameReducer(state, { type: "SET_SLOT_SEGMENT", index, segment: 20 });
    state = gameReducer(state, { type: "SET_SLOT_MULTIPLIER", index, multiplier: 3 });
  }
  return state;
};

const segments = (state: GameState): (number | null)[] =>
  state.currentSlots.map((s) => s.segment);

describe("DartInput slot order", () => {
  it("marks the first slot as active for an empty turn", () => {
    expect(getActiveSlotIndex([emptySlot(), emptySlot(), emptySlot()])).toBe(0);
  });

  it("always targets the leftmost empty slot", () => {
    expect(getActiveSlotIndex([slot(20), emptySlot(), emptySlot()])).toBe(1);
    expect(getActiveSlotIndex([slot(20), slot(19), emptySlot()])).toBe(2);
    expect(getActiveSlotIndex([slot(20), slot(19), slot(18)])).toBeNull();
  });

  it("keeps later empty slots locked until earlier slots are filled", () => {
    const slots: [DartSlot, DartSlot, DartSlot] = [slot(20), emptySlot(), emptySlot()];

    expect(canUseSlotControls(slots, 0)).toBe(true);
    expect(canUseSlotControls(slots, 1)).toBe(true);
    expect(canUseSlotControls(slots, 2)).toBe(false);
  });

  it("keeps all multiplier controls available before number entry", () => {
    const slots: [DartSlot, DartSlot, DartSlot] = [emptySlot(), emptySlot(), emptySlot()];

    expect(canUseMultiplierControls(slots, 0)).toBe(true);
    expect(canUseMultiplierControls(slots, 1)).toBe(true);
    expect(canUseMultiplierControls(slots, 2)).toBe(true);
  });

  // Antippen des Wertes über den Multiplikatoren leert den Slot. Die nächste
  // Zahl muss dann in genau diesen Slot laufen, nicht in den, der nach der
  // Links-nach-rechts-Regel ursprünglich an der Reihe war.
  it("refills the middle slot after it was cleared", () => {
    let state = turnInProgress();
    expect(segments(state)).toEqual([20, 20, 20]);

    state = gameReducer(state, { type: "CLEAR_SLOT", index: 1 });
    expect(segments(state)).toEqual([20, null, 20]);
    expect(getActiveSlotIndex(state.currentSlots)).toBe(1);

    state = gameReducer(state, {
      type: "SET_SLOT_SEGMENT",
      index: getActiveSlotIndex(state.currentSlots)!,
      segment: 19,
    });
    expect(segments(state)).toEqual([20, 19, 20]);
  });

  it("refills the left slot after it was cleared", () => {
    let state = turnInProgress();

    state = gameReducer(state, { type: "CLEAR_SLOT", index: 0 });
    expect(segments(state)).toEqual([null, 20, 20]);
    expect(getActiveSlotIndex(state.currentSlots)).toBe(0);

    state = gameReducer(state, {
      type: "SET_SLOT_SEGMENT",
      index: getActiveSlotIndex(state.currentSlots)!,
      segment: 19,
    });
    expect(segments(state)).toEqual([19, 20, 20]);
  });

  it("resets the multiplier of a cleared slot", () => {
    const state = gameReducer(turnInProgress(), { type: "CLEAR_SLOT", index: 1 });

    expect(state.currentSlots[1]).toEqual(emptySlot());
    expect(state.currentSlots[0].multiplier).toBe(3);
    expect(state.currentSlots[2].multiplier).toBe(3);
  });

  it("undoes the running input from right to left", () => {
    expect(getRunningInputUndoTarget([slot(20), slot(19), slot(18)])).toBe(2);
    expect(getRunningInputUndoTarget([slot(20), slot(19), emptySlot()])).toBe(1);
    expect(getRunningInputUndoTarget([emptySlot(), emptySlot(), emptySlot()])).toBe(-1);
  });
});
