import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DartInput } from "./DartInput";
import type { DartSlot, Multiplier } from "../game/types";
import { emptySlot } from "../game/types";

const slot = (segment: number, multiplier: Multiplier = 1): DartSlot => ({ segment, multiplier });

const render = (slots: [DartSlot, DartSlot, DartSlot], remaining = 501): string =>
  renderToStaticMarkup(
    <DartInput
      slots={slots}
      remaining={remaining}
      onSetSegment={vi.fn()}
      onSetMultiplier={vi.fn()}
      onClearSlot={vi.fn()}
      onConfirmTurn={vi.fn()}
      onUndo={vi.fn()}
      onAbort={vi.fn()}
      canUndo={false}
      isEditing={false}
      onCancelEdit={vi.fn()}
      canSwitchStartingPlayer={false}
      onSwitchStartingPlayer={vi.fn()}
    />
  );

// Die laufende Summe steht im <strong> des Totals-Blocks.
const runningTotal = (markup: string): string =>
  /aria-label="Aufnahme und Restscore"><strong>(.*?)<\/strong>/.exec(markup)?.[1] ?? "";

describe("DartInput totals", () => {
  it("leaves the running total blank before the first dart", () => {
    expect(runningTotal(render([emptySlot(), emptySlot(), emptySlot()]))).toBe(" ");
  });

  it("shows the running total as soon as a dart is entered", () => {
    expect(runningTotal(render([slot(20, 3), emptySlot(), emptySlot()]))).toBe("60");
  });

  it("shows a zero for an entered miss, not a blank", () => {
    expect(runningTotal(render([slot(0), emptySlot(), emptySlot()]))).toBe("0");
  });
});
