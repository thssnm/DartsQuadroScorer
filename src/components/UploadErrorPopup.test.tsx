import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UPLOAD_ERROR_MESSAGE, UPLOAD_RETRY_LABEL, UploadErrorPopup } from "./UploadErrorPopup";

const render = (overrides: Partial<Parameters<typeof UploadErrorPopup>[0]> = {}): string =>
  renderToStaticMarkup(
    <UploadErrorPopup onRetry={vi.fn()} onConfirm={vi.fn()} retrying={false} {...overrides} />
  );

describe("UploadErrorPopup", () => {
  it("renders the exact tournament reporting message", () => {
    expect(render()).toContain(UPLOAD_ERROR_MESSAGE);
  });

  it("offers a retry next to the acknowledge button", () => {
    const markup = render();

    expect(markup).toContain(UPLOAD_RETRY_LABEL);
    expect(markup).toContain("Verstanden");
    expect(markup.indexOf(UPLOAD_RETRY_LABEL)).toBeLessThan(markup.indexOf("Verstanden"));
  });

  it("locks both buttons while a retry is running", () => {
    const markup = render({ retrying: true });

    expect(markup).toContain("Upload läuft");
    expect([...markup.matchAll(/<button[^>]*disabled/g)]).toHaveLength(2);
  });

  it("shows the error cause in small print when known", () => {
    expect(render({ detail: "Gist nicht gefunden (404): Gist-ID prüfen." })).toContain(
      "Gist nicht gefunden (404)"
    );
    expect(render()).not.toContain("leg-overlay__detail");
  });
});
