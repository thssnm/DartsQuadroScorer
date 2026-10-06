import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResultOverlay, UNDO_RESULT_LABEL } from "./ResultOverlay";

describe("ResultOverlay", () => {
  it("renders the confirm button next to the undo button", () => {
    const markup = renderToStaticMarkup(
      <ResultOverlay
        title="A gewinnt das Leg!"
        summary="Legs: A 1 : 0 B"
        confirmLabel="Nächstes Leg"
        onConfirm={vi.fn()}
        onUndo={vi.fn()}
      />
    );

    expect(markup).toContain("A gewinnt das Leg!");
    expect(markup).toContain("Nächstes Leg");
    expect(markup).toContain(UNDO_RESULT_LABEL);
    expect(markup.indexOf("Nächstes Leg")).toBeLessThan(markup.indexOf(UNDO_RESULT_LABEL));
  });
});
