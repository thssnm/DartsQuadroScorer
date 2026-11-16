import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CHECKOUT_PROMPT_TITLE, CheckoutDartsPrompt } from "./CheckoutDartsPrompt";

describe("CheckoutDartsPrompt", () => {
  it("offers one, two or three darts and a cancel", () => {
    const markup = renderToStaticMarkup(<CheckoutDartsPrompt onChoose={vi.fn()} onCancel={vi.fn()} />);

    expect(markup).toContain(CHECKOUT_PROMPT_TITLE);
    expect(markup).toContain("Mit wie vielen Darts?");
    expect(markup).toContain(">1 Dart</button>");
    expect(markup).toContain(">2 Darts</button>");
    expect(markup).toContain(">3 Darts</button>");
    expect(markup).toContain("Abbrechen");
  });
});
