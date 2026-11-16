import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ScoreInput } from "./ScoreInput";

const render = (overrides: Partial<Parameters<typeof ScoreInput>[0]> = {}): string =>
  renderToStaticMarkup(
    <ScoreInput
      draft=""
      remaining={301}
      shortcuts={[140, 100, 80, 60, 41, 45]}
      onDigit={vi.fn()}
      onBackspace={vi.fn()}
      onShortcut={vi.fn()}
      onConfirm={vi.fn()}
      onUndo={vi.fn()}
      onAbort={vi.fn()}
      canUndo={false}
      isEditing={false}
      onCancelEdit={vi.fn()}
      canSwitchStartingPlayer={false}
      onSwitchStartingPlayer={vi.fn()}
      {...overrides}
    />
  );

const buttons = (markup: string, className: string): string[] =>
  [...markup.matchAll(new RegExp(`<button[^>]*class="${className}[^"]*"[^>]*>.*?</button>`, "g"))].map((m) => m[0]);

describe("ScoreInput", () => {
  it("renders a numpad with ten digits, backspace and confirm", () => {
    const markup = render();

    expect(buttons(markup, "score-btn")).toHaveLength(12);
    for (const digit of "0123456789") expect(markup).toContain(`>${digit}</button>`);
    expect(markup).toContain("Aufnahme bestätigen");
    expect(markup).not.toContain("num-btn");
  });

  it("renders the shortcuts in the given order", () => {
    const markup = render({ shortcuts: [26, 60, 41, 100, 140, 80] });

    expect(buttons(markup, "score-shortcut-btn").map((b) => b.replace(/<[^>]*>/g, ""))).toEqual([
      "26",
      "60",
      "41",
      "100",
      "140",
      "80",
    ]);
  });

  it("previews the remaining score and marks checkout and bust", () => {
    expect(render({ draft: "140" })).toContain(">161</span>");
    expect(render({ draft: "140", remaining: 140 })).toContain('class="checkout">0</span>');
    expect(render({ draft: "240", remaining: 200 })).toContain('class="bust">-40</span>');
    expect(render({ draft: "40", remaining: 41 })).toContain('class="bust">1</span>');
  });

  it("disables confirm and backspace without a typed score", () => {
    const markup = render();
    const [confirm] = buttons(markup, "score-btn score-btn--confirm");
    const [backspace] = buttons(markup, "score-btn score-btn--backspace");

    expect(confirm).toContain("disabled");
    expect(backspace).toContain("disabled");
    expect(buttons(render({ draft: "26" }), "score-btn score-btn--confirm")[0]).not.toContain("disabled");
  });

  it("shows the edit banner and the undo/abort actions", () => {
    const markup = render({ isEditing: true, canUndo: true });

    expect(markup).toContain("Aufnahme wird korrigiert");
    expect(markup).toContain("Korrektur übernehmen");
    expect(markup).toContain("Rückgängig");
    expect(markup).toContain("Spiel abbrechen");
  });
});
