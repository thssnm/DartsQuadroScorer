import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlayerNameField, SetupScreen } from "./SetupScreen";

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

describe("SetupScreen", () => {
  it("renders the Love for Darts sponsor link before the setup content", () => {
    const markup = renderToStaticMarkup(
      <SetupScreen onStart={vi.fn()} resultUploadEnabled={false} gistConfig={{ token: "", gistId: "" }} />
    );

    expect(markup).toContain('class="setup-sponsor"');
    expect(markup).toContain('href="https://lovefordarts.de"');
    expect(markup).toContain('target="_blank"');
    expect(markup.indexOf('class="setup-sponsor"')).toBeLessThan(markup.indexOf("<h1>"));
    expect(markup).toContain('alt="Love for Darts"');
  });
});
