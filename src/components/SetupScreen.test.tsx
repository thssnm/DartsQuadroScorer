import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlayerNameField } from "./SetupScreen";

describe("PlayerNameField", () => {
  it("renders a dropdown when player names are available", () => {
    const markup = renderToStaticMarkup(
      <PlayerNameField label="Spieler 1" value="Heim" playerNames={["Alice"]} onChange={vi.fn()} />
    );

    expect(markup).toContain("<select");
    expect(markup).toContain("Alice");
  });

  it("does not render a dropdown without player names", () => {
    const markup = renderToStaticMarkup(
      <PlayerNameField label="Spieler 1" value="Heim" playerNames={[]} onChange={vi.fn()} />
    );

    expect(markup).not.toContain("<select");
  });
});
