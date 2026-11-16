import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import { loadMatchHistory } from "../game/persistence";
import type { GameState } from "../game/types";
import { recordFinishedMatch } from "./matchHistory";
import { stubLocalStorage } from "./testHelpers";

const HISTORY_KEY = "darts-quadro-scorer:match-history";

// Heim gewinnt 1:0; im abgeschlossenen Leg steht eine 180er-Aufnahme, damit
// Average und Highlights nicht leer sind.
const finishedMatch = (): GameState => {
  const initial = createInitialState("Alice", "Bob", 1);
  const t180 = {
    darts: [
      { segment: 20, multiplier: 3 as const },
      { segment: 20, multiplier: 3 as const },
      { segment: 20, multiplier: 3 as const },
    ],
    scoreBefore: 501,
    scoreAfter: 321,
    bust: false,
  };
  const checkout = {
    darts: [{ segment: 20, multiplier: 2 as const }],
    scoreBefore: 141,
    scoreAfter: 0,
    bust: false,
  };
  return {
    ...initial,
    phase: "match-finished",
    players: [
      {
        ...initial.players[0],
        legsWon: 1,
        remaining: 0,
        legHistory: [{ turns: [t180, { ...t180, scoreBefore: 321, scoreAfter: 141 }, checkout], won: true }],
      },
      { ...initial.players[1], legHistory: [{ turns: [t180], won: false }] },
    ],
  };
};

describe("local match history", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records a finished match with averages and highlights", () => {
    stubLocalStorage();

    recordFinishedMatch(finishedMatch(), "Board 3");
    const [entry] = loadMatchHistory();

    expect(entry).toMatchObject({
      boardName: "Board 3",
      home: "Alice",
      guest: "Bob",
      legsHome: 1,
      legsGuest: 0,
    });
    expect(entry.averageHome).toBeGreaterThan(0);
    expect(entry.highlights).toContain("180 (Alice)");
    expect(entry.updatedAt).toBeTypeOf("string");
  });

  it("does not add a second entry for the same match after a reload", () => {
    stubLocalStorage();

    const first = recordFinishedMatch(finishedMatch(), "Board 1");
    const second = recordFinishedMatch(finishedMatch(), "Board 1");

    expect(second).toBe(first);
    expect(loadMatchHistory()).toHaveLength(1);
  });

  it("keeps older matches when a new one is finished", () => {
    const store = stubLocalStorage();

    recordFinishedMatch(finishedMatch(), "Board 1");
    // Nächstes Match: die Zuordnung zum laufenden Match verfällt.
    store.delete("darts-quadro-scorer:match-history-id");
    recordFinishedMatch(finishedMatch(), "Board 2");

    const entries = loadMatchHistory();
    expect(entries).toHaveLength(2);
    // Neueste zuerst.
    expect(entries[0].boardName).toBe("Board 2");
    expect(entries[1].boardName).toBe("Board 1");
  });

  it("survives a damaged entry in localStorage", () => {
    stubLocalStorage({ [HISTORY_KEY]: "kein json" });

    expect(loadMatchHistory()).toEqual([]);
  });
});
