import { describe, expect, it } from "vitest";
import { createInitialState } from "./gameReducer";
import { computeHighlights } from "./highlights";
import type { CompletedLeg, Dart, GameState, Multiplier, PlayerState, Turn } from "./types";

const dart = (segment: number, multiplier: Multiplier = 1): Dart => ({ segment, multiplier });
const turn = (darts: Dart[], scoreAfter = 100, bust = false): Turn => ({
  darts,
  scoreBefore: scoreAfter + darts.reduce((sum, d) => sum + d.segment * d.multiplier, 0),
  scoreAfter,
  bust,
});
const checkout = (darts: Dart[]): Turn => turn(darts, 0);

const playerWithLegs = (player: PlayerState, legs: CompletedLeg[], legsWon: number): PlayerState => ({
  ...player,
  remaining: 0,
  turns: [],
  legsWon,
  legHistory: legs,
});

const finishedState = (homeLegs: CompletedLeg[], guestLegs: CompletedLeg[] = []): GameState => {
  const state = createInitialState("Alice", "Bob", 1);
  return {
    ...state,
    phase: "match-finished",
    players: [
      playerWithLegs(state.players[0], homeLegs, homeLegs.filter((leg) => leg.won).length),
      playerWithLegs(state.players[1], guestLegs, guestLegs.filter((leg) => leg.won).length),
    ],
  };
};

describe("computeHighlights", () => {
  it("detects a won leg with 18 darts as a fast leg", () => {
    const scoringTurn = turn([dart(20), dart(20), dart(20)]);
    const state = finishedState([
      {
        won: true,
        turns: [
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          checkout([dart(10), dart(10), dart(20, 2)]),
        ],
      },
    ]);

    expect(computeHighlights(state)).toEqual(["18 Darts (Alice)"]);
  });

  it("detects a checkout above 100 as a high finish", () => {
    const scoringTurn = turn([dart(20), dart(20), dart(20)]);
    const state = finishedState(
      [{ won: false, turns: [scoringTurn, scoringTurn, scoringTurn, scoringTurn, scoringTurn, scoringTurn] }],
      [
        {
          won: true,
          turns: [
            scoringTurn,
            scoringTurn,
            scoringTurn,
            scoringTurn,
            scoringTurn,
            scoringTurn,
            checkout([dart(20, 3), dart(20, 2), dart(20)]),
          ],
        },
      ]
    );

    expect(computeHighlights(state)).toEqual(["120 Finish (Bob)"]);
  });

  it("detects a non-bust turn above 170 as a high turn", () => {
    const scoringTurn = turn([dart(20), dart(20), dart(20)]);
    const state = finishedState([
      {
        won: true,
        turns: [
          turn([dart(20, 3), dart(20, 3), dart(20, 3)]),
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          checkout([dart(20, 2)]),
        ],
      },
    ]);

    expect(computeHighlights(state)).toEqual(["180 (Alice)"]);
  });

  it("keeps both entries when a checkout above 170 is also a high turn", () => {
    const scoringTurn = turn([dart(20), dart(20), dart(20)]);
    const state = finishedState([
      {
        won: true,
        turns: [
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          checkout([dart(20, 4), dart(20, 4), dart(11)]),
        ],
      },
    ]);

    expect(computeHighlights(state)).toEqual(["171 Finish (Alice)", "171 (Alice)"]);
  });

  it("returns an empty array when no highlight threshold is reached", () => {
    const scoringTurn = turn([dart(20), dart(20), dart(20)]);
    const state = finishedState([
      {
        won: true,
        turns: [
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          checkout([dart(20, 2)]),
        ],
      },
    ]);

    expect(computeHighlights(state)).toEqual([]);
  });

  it("ignores busts above 170", () => {
    const scoringTurn = turn([dart(20), dart(20), dart(20)]);
    const state = finishedState([
      {
        won: true,
        turns: [
          turn([dart(20, 3), dart(20, 3), dart(20, 3)], 321, true),
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          scoringTurn,
          checkout([dart(20, 2)]),
        ],
      },
    ]);

    expect(computeHighlights(state)).toEqual([]);
  });
});
