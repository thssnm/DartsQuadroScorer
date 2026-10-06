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
const renderAfterReload = (stored: Record<string, string>): string => {
  const store = new Map(Object.entries(stored));
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
  return renderToStaticMarkup(<App />);
};

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
