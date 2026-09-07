import type { DartSlot } from "../game/types";

export const getActiveSlotIndex = (slots: [DartSlot, DartSlot, DartSlot]): number | null => {
  const nextOpen = slots.findIndex((s) => s.segment === null);
  return nextOpen === -1 ? null : nextOpen;
};

export const canUseSlotControls = (
  slots: [DartSlot, DartSlot, DartSlot],
  index: number
): boolean => {
  const slot = slots[index];
  if (!slot) return false;
  return slot.segment !== null || getActiveSlotIndex(slots) === index;
};

export const canUseMultiplierControls = (
  slots: [DartSlot, DartSlot, DartSlot],
  index: number
): boolean => Boolean(slots[index]);
