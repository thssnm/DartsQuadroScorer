import { describe, expect, it } from "vitest";
import { createInitialState } from "./gameReducer";
import { isMatchOver, matchTitle, matchWinner } from "./matchEnd";
import type { GameState } from "./types";

const withLegs = (legsA: number, legsB: number, bestOf = 3): GameState => {
  const base = createInitialState("A", "B", bestOf);
  return {
    ...base,
    players: [
      { ...base.players[0], legsWon: legsA },
      { ...base.players[1], legsWon: legsB },
    ],
  };
};

describe("isMatchOver", () => {
  it("ends an odd best-of as soon as one player has more than half", () => {
    expect(isMatchOver(withLegs(1, 0).players, 3)).toBe(false);
    expect(isMatchOver(withLegs(1, 1).players, 3)).toBe(false);
    expect(isMatchOver(withLegs(2, 0).players, 3)).toBe(true);
    expect(isMatchOver(withLegs(1, 2).players, 3)).toBe(true);
    expect(isMatchOver(withLegs(0, 3).players, 5)).toBe(true);
    expect(isMatchOver(withLegs(2, 2).players, 5)).toBe(false);
  });

  it("ends an even best-of on a clear win or once every leg is played", () => {
    expect(isMatchOver(withLegs(1, 0).players, 2)).toBe(false);
    expect(isMatchOver(withLegs(2, 0).players, 2)).toBe(true);
    expect(isMatchOver(withLegs(0, 2).players, 2)).toBe(true);
    expect(isMatchOver(withLegs(1, 1).players, 2)).toBe(true);
    expect(isMatchOver(withLegs(2, 1).players, 4)).toBe(false);
    expect(isMatchOver(withLegs(3, 1).players, 4)).toBe(true);
    expect(isMatchOver(withLegs(2, 2).players, 4)).toBe(true);
  });
});

describe("matchWinner / matchTitle", () => {
  it("names the player with more legs", () => {
    expect(matchWinner(withLegs(2, 0))?.name).toBe("A");
    expect(matchWinner(withLegs(1, 3, 4))?.name).toBe("B");
    expect(matchTitle(withLegs(2, 0))).toBe("A gewinnt das Match!");
  });

  it("reports a draw when both have the same legs", () => {
    expect(matchWinner(withLegs(1, 1, 2))).toBeNull();
    expect(matchTitle(withLegs(1, 1, 2))).toBe("Unentschieden!");
  });
});
