import { describe, expect, it } from "vitest";
import { canUseSlotControls, getActiveSlotIndex } from "./dartInputOrder";
import type { DartSlot, Multiplier } from "../game/types";
import { emptySlot } from "../game/types";

const slot = (segment: number, multiplier: Multiplier = 1): DartSlot => ({ segment, multiplier });

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
});
