import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { UNDO_RESULT_LABEL } from "./components/ResultOverlay";
import { createInitialState, gameReducer } from "./game/gameReducer";
import type { GameState } from "./game/types";

const GAME_STATE_KEY = "darts-quadro-scorer:game-state";
const MATCH_CONFIRMED_KEY = "darts-quadro-scorer:match-confirmed";

// Match über ein einziges Leg: Spieler A checkt 40 mit D20 aus.
const finishedMatch = (): GameState => {
  const initial = createInitialState("Alice", "Bob", 1);
  let state: GameState = {
    ...initial,
    phase: "playing",
    players: [{ ...initial.players[0], remaining: 40 }, initial.players[1]],
  };
  state = gameReducer(state, { type: "SET_SLOT_SEGMENT", index: 0, segment: 20 });
  state = gameReducer(state, { type: "SET_SLOT_MULTIPLIER", index: 0, multiplier: 2 });
  return gameReducer(state, { type: "CONFIRM_TURN" });
};

// Simuliert einen App-Start mit dem Inhalt, den localStorage überlebt hat.
const renderAfterReload = (stored: Record<string, string>, search = ""): string => {
  const store = new Map(Object.entries(stored));
  vi.stubGlobal("window", {
    location: { search },
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
  return renderToStaticMarkup(<App />);
};

// Best of 2 steht 1:0 für Alice, Bob checkt 40 mit D20 - 1:1, Match aus.
const drawnMatch = (): GameState => {
  const initial = createInitialState("Alice", "Bob", 2);
  let state: GameState = {
    ...initial,
    phase: "playing",
    activePlayer: 1,
    players: [
      { ...initial.players[0], legsWon: 1 },
      { ...initial.players[1], remaining: 40 },
    ],
  };
  state = gameReducer(state, { type: "SET_SLOT_SEGMENT", index: 0, segment: 20 });
  state = gameReducer(state, { type: "SET_SLOT_MULTIPLIER", index: 0, multiplier: 2 });
  return gameReducer(state, { type: "CONFIRM_TURN" });
};

describe("App in score input mode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the numpad with shortcuts instead of the dart grid", () => {
    const state: GameState = { ...createInitialState("Alice", "Bob", 3, "score"), phase: "playing" };
    const markup = renderAfterReload({
      [GAME_STATE_KEY]: JSON.stringify(state),
      "darts-quadro-scorer:score-frequency": JSON.stringify({ "26": 3 }),
    });

    expect(markup).toContain("score-input__numpad");
    expect(markup).toContain("Häufige Scores");
    expect(markup).toContain(">26</button>");
    expect(markup).not.toContain("num-btn");
  });

  it("keeps the dart grid in single-dart mode", () => {
    const state: GameState = { ...createInitialState("Alice", "Bob", 3), phase: "playing" };
    const markup = renderAfterReload({ [GAME_STATE_KEY]: JSON.stringify(state) });

    expect(markup).toContain("num-btn");
    expect(markup).not.toContain("score-input__numpad");
  });
});

describe("App with a drawn match", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the draw in the result popup and in the statistics", () => {
    const state = drawnMatch();
    expect(state.phase).toBe("match-finished");

    const popup = renderAfterReload({ [GAME_STATE_KEY]: JSON.stringify(state) });
    expect(popup).toContain("Unentschieden!");
    expect(popup).toContain("Legs: Alice 1 : 1 Bob");
    expect(popup).toContain("Weiter zur Statistik");

    const stats = renderAfterReload({ [GAME_STATE_KEY]: JSON.stringify(state), [MATCH_CONFIRMED_KEY]: "true" });
    expect(stats).toContain('class="match-stats"');
    expect(stats).toContain("Unentschieden!");
  });
});

describe("settings access", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers no settings button without the URL parameter", () => {
    const markup = renderAfterReload({});

    expect(markup).not.toContain("Einstellungen öffnen");
    expect(markup).toContain("Match-Historie öffnen");
  });

  it("offers the settings button with ?settings, during the match as well", () => {
    expect(renderAfterReload({}, "?settings")).toContain("Einstellungen öffnen");
    expect(renderAfterReload({ [GAME_STATE_KEY]: JSON.stringify(finishedMatch()) }, "?settings")).toContain(
      "Einstellungen öffnen"
    );
    expect(renderAfterReload({ [GAME_STATE_KEY]: JSON.stringify(finishedMatch()) })).not.toContain(
      "Einstellungen öffnen"
    );
  });
});

describe("App after a reload with a finished match", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the result popup with the undo option while the match is unconfirmed", () => {
    const markup = renderAfterReload({ [GAME_STATE_KEY]: JSON.stringify(finishedMatch()) });

    expect(markup).toContain("Alice gewinnt das Match!");
    expect(markup).toContain("Weiter zur Statistik");
    expect(markup).toContain(UNDO_RESULT_LABEL);
    expect(markup).not.toContain('class="match-stats"');
  });

  it("goes straight to the statistics once the match has been confirmed", () => {
    const markup = renderAfterReload({
      [GAME_STATE_KEY]: JSON.stringify(finishedMatch()),
      [MATCH_CONFIRMED_KEY]: "true",
    });

    expect(markup).toContain('class="match-stats"');
    expect(markup).not.toContain("Weiter zur Statistik");
    expect(markup).not.toContain(UNDO_RESULT_LABEL);
  });
});
