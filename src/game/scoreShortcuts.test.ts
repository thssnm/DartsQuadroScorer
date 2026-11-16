import { describe, expect, it } from "vitest";
import { createInitialState } from "./gameReducer";
import { DEFAULT_SCORE_SHORTCUTS, addMatchScores, scoreShortcuts } from "./scoreShortcuts";
import type { GameState, Turn } from "./types";

const scoreTurn = (score: number, bust = false): Turn => ({
  darts: [],
  score,
  dartCount: 3,
  scoreBefore: 501,
  scoreAfter: 501 - score,
  bust,
});

const finished = (homeScores: number[], guestScores: number[], runningScores: number[] = []): GameState => {
  const base = createInitialState("A", "B", 3, "score");
  return {
    ...base,
    phase: "match-finished",
    players: [
      { ...base.players[0], legHistory: [{ won: true, turns: homeScores.map((s) => scoreTurn(s)) }], turns: runningScores.map((s) => scoreTurn(s)) },
      { ...base.players[1], legHistory: [{ won: false, turns: guestScores.map((s) => scoreTurn(s)) }] },
    ],
  };
};

describe("scoreShortcuts", () => {
  it("starts with the defaults", () => {
    expect(scoreShortcuts({})).toEqual([140, 100, 80, 60, 41, 45]);
    expect(DEFAULT_SCORE_SHORTCUTS).toHaveLength(6);
  });

  it("puts the most frequent scores first and fills up with the defaults", () => {
    expect(scoreShortcuts({ "26": 5, "45": 2, "99": 1 })).toEqual([26, 45, 99, 140, 100, 80]);
  });

  it("breaks ties by the higher score", () => {
    expect(scoreShortcuts({ "26": 2, "81": 2, "60": 2 })).toEqual([81, 60, 26, 140, 100, 80]);
  });

  it("ignores damaged counts", () => {
    expect(scoreShortcuts({ abc: 3, "60": 0 })).toEqual(DEFAULT_SCORE_SHORTCUTS);
  });
});

describe("addMatchScores", () => {
  it("counts every non-bust turn of both players, finished legs and running turns", () => {
    const counts = addMatchScores({ "26": 1 }, finished([26, 60, 140], [26, 45], [26]));

    expect(counts).toEqual({ "26": 4, "60": 1, "140": 1, "45": 1 });
  });

  it("skips busted turns", () => {
    const state = finished([], []);
    state.players[0].legHistory[0].turns.push(scoreTurn(60, true));

    expect(addMatchScores({}, state)).toEqual({});
  });

  it("does not change the shortcut order until the match is over", () => {
    // Die Sortierung passiert ausschließlich über scoreShortcuts(counts) beim
    // Matchstart - addMatchScores selbst liefert nur Zähler.
    const counts = addMatchScores({}, finished([26, 26, 26], []));
    expect(scoreShortcuts({})).toEqual(DEFAULT_SCORE_SHORTCUTS);
    expect(scoreShortcuts(counts)[0]).toBe(26);
  });
});
