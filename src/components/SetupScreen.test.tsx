import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlayerNameField, SetupScreen } from "./SetupScreen";
import { DEFAULT_BEST_OF, legsToWinFromBestOf } from "./setupLegs";

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

describe("legsToWinFromBestOf", () => {
  it("maps best-of to the legs needed to win", () => {
    expect(legsToWinFromBestOf("1")).toBe(1);
    expect(legsToWinFromBestOf("3")).toBe(2);
    expect(legsToWinFromBestOf("5")).toBe(3);
    expect(legsToWinFromBestOf("11")).toBe(6);
  });

  it("treats an even number like the next lower odd one", () => {
    expect(legsToWinFromBestOf("4")).toBe(2);
  });

  it("falls back to the default for empty or invalid input", () => {
    expect(DEFAULT_BEST_OF).toBe(3);
    expect(legsToWinFromBestOf("")).toBe(2);
    expect(legsToWinFromBestOf("0")).toBe(2);
    expect(legsToWinFromBestOf("-3")).toBe(2);
    expect(legsToWinFromBestOf("abc")).toBe(2);
  });
});

describe("SetupScreen", () => {
  it("offers a whole-number input for best-of with default 3", () => {
    const markup = renderToStaticMarkup(<SetupScreen onStart={vi.fn()} resultUploadEnabled={false} />);
    const [bestOfInput] = [...markup.matchAll(/<input[^>]*type="number"[^>]*>/g)].map((m) => m[0]);

    expect(bestOfInput).toContain('value="3"');
    expect(bestOfInput).toContain('min="1"');
    expect(markup).toContain("Best of (Legs)");
    expect(markup).not.toContain("Best of 7");
  });


  it("renders the Love for Darts sponsor link before the setup content", () => {
    const markup = renderToStaticMarkup(
      <SetupScreen onStart={vi.fn()} resultUploadEnabled={false} />
    );

    expect(markup).toContain('class="setup-sponsor"');
    expect(markup).toContain('href="https://lovefordarts.de"');
    expect(markup).toContain('target="_blank"');
    expect(markup.indexOf('class="setup-sponsor"')).toBeLessThan(markup.indexOf("<h1>"));
    expect(markup).toContain('alt="Love for Darts"');
  });
});
