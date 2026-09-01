import { describe, expect, it } from "vitest";
import { computePlayerStats } from "./stats";
import type { Dart, Multiplier, PlayerState, Turn } from "./types";

const dart = (segment: number, multiplier: Multiplier = 1): Dart => ({ segment, multiplier });
const turn = (darts: Dart[], bust = false): Turn => ({
  darts,
  scoreBefore: 501,
  scoreAfter: 501,
  bust,
});

describe("computePlayerStats", () => {
  it("computes averages per thrown dart times 3, including short finishes", () => {
    const player: PlayerState = {
      name: "A",
      remaining: 0,
      turns: [turn([dart(20), dart(20), dart(20)]), turn([dart(20, 2)])],
      legsWon: 0,
      legHistory: [],
    };

    const stats = computePlayerStats(player);

    expect(stats.legAverage).toBe(75);
    expect(stats.matchAverage).toBe(75);
  });

  it("finds the won leg with the fewest darts and ignores lost legs", () => {
    const player: PlayerState = {
      name: "A",
      remaining: 501,
      turns: [],
      legsWon: 2,
      legHistory: [
        { won: true, turns: [turn([dart(20), dart(20), dart(20)]), turn([dart(20), dart(20)])] },
        { won: false, turns: [turn([dart(20)])] },
        { won: true, turns: [turn([dart(20), dart(20), dart(20)])] },
      ],
    };

    expect(computePlayerStats(player).bestLeg).toEqual({ darts: 3 });
  });

  it("counts 140+, 180+, and 240 turns while ignoring busts", () => {
    const player: PlayerState = {
      name: "A",
      remaining: 501,
      turns: [
        turn([dart(20, 4), dart(20, 4), dart(20, 4)]),
        turn([dart(20, 3), dart(20, 3), dart(20, 3)]),
        turn([dart(20, 3), dart(20, 2), dart(20, 2)]),
        turn([dart(20, 4), dart(20, 4), dart(20, 4)], true),
      ],
      legsWon: 0,
      legHistory: [],
    };

    const stats = computePlayerStats(player);

    expect(stats.count240).toBe(1);
    expect(stats.count180Plus).toBe(2);
    expect(stats.count140Plus).toBe(3);
  });
});
