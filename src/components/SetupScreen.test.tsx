import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerNameField, SetupScreen } from "./SetupScreen";
import { DEFAULT_BEST_OF, bestOfFromInput } from "./setupLegs";

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

describe("bestOfFromInput", () => {
  it("accepts odd and even whole numbers", () => {
    expect(bestOfFromInput("1")).toBe(1);
    expect(bestOfFromInput("2")).toBe(2);
    expect(bestOfFromInput("3")).toBe(3);
    expect(bestOfFromInput("4")).toBe(4);
    expect(bestOfFromInput("11")).toBe(11);
  });

  it("falls back to the default for empty or invalid input", () => {
    expect(DEFAULT_BEST_OF).toBe(3);
    expect(bestOfFromInput("")).toBe(3);
    expect(bestOfFromInput("0")).toBe(3);
    expect(bestOfFromInput("-3")).toBe(3);
    expect(bestOfFromInput("abc")).toBe(3);
  });
});

const stubLocalStorage = (initial: Record<string, string> = {}) => {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
};

describe("SetupScreen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefills best-of with the last started match", () => {
    stubLocalStorage({ "darts-quadro-scorer:best-of": "5" });

    const markup = renderToStaticMarkup(<SetupScreen onStart={vi.fn()} />);
    const [bestOfInput] = [...markup.matchAll(/<input[^>]*type="number"[^>]*>/g)].map((m) => m[0]);

    expect(bestOfInput).toContain('value="5"');
  });

  it("defaults to single-dart input and remembers the last choice", () => {
    stubLocalStorage();
    const checkbox = (markup: string) => [...markup.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map((m) => m[0])[0];

    const fresh = renderToStaticMarkup(<SetupScreen onStart={vi.fn()} />);
    expect(fresh).toContain("Einzeldarteingabe");
    expect(checkbox(fresh)).toContain("checked");

    stubLocalStorage({ "darts-quadro-scorer:input-mode": "score" });
    expect(checkbox(renderToStaticMarkup(<SetupScreen onStart={vi.fn()} />))).not.toContain("checked");
  });

  it("offers a whole-number input for best-of with default 3", () => {
    stubLocalStorage();
    const markup = renderToStaticMarkup(<SetupScreen onStart={vi.fn()} />);
    const [bestOfInput] = [...markup.matchAll(/<input[^>]*type="number"[^>]*>/g)].map((m) => m[0]);

    expect(bestOfInput).toContain('value="3"');
    expect(bestOfInput).toContain('min="1"');
    expect(markup).toContain("Best of (Legs)");
    expect(markup).not.toContain("Best of 7");
  });


  it("renders the Love for Darts sponsor link before the setup content", () => {
    stubLocalStorage();
    const markup = renderToStaticMarkup(
      <SetupScreen onStart={vi.fn()} />
    );

    expect(markup).toContain('class="setup-sponsor"');
    expect(markup).toContain('href="https://lovefordarts.de"');
    expect(markup).toContain('target="_blank"');
    expect(markup.indexOf('class="setup-sponsor"')).toBeLessThan(markup.indexOf("<h1>"));
    expect(markup).toContain('alt="Love for Darts"');
  });
});
