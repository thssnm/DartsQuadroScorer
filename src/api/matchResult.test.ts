import { describe, expect, it } from "vitest";
import { createInitialState } from "../game/gameReducer";
import type { Dart, Multiplier, Turn } from "../game/types";
import { createMatchId, defaultBoardName, mapGameStateToResult } from "./matchResult";

const dart = (segment: number, multiplier: Multiplier = 1): Dart => ({ segment, multiplier });
const turn = (darts: Dart[], scoreBefore: number, scoreAfter: number, bust = false): Turn => ({
  darts,
  scoreBefore,
  scoreAfter,
  bust,
});

describe("mapGameStateToResult", () => {
  it("maps a finished match to the result record", () => {
    const base = createInitialState("Alice", "Bob", 2);
    const state = {
      ...base,
      phase: "match-finished" as const,
      players: [
        { ...base.players[0], legsWon: 2 },
        { ...base.players[1], legsWon: 0 },
      ] as typeof base.players,
    };

    expect(mapGameStateToResult(state, "Board 1", "2026-09-02T10:15:00Z")).toEqual({
      boardName: "Board 1",
      home: "Alice",
      guest: "Bob",
      legsHome: 2,
      legsGuest: 0,
      highlights: [],
      updatedAt: "2026-09-02T10:15:00Z",
    });
  });

  it("maps rounded match averages when players have thrown darts", () => {
    const base = createInitialState("Alice", "Bob", 2);
    const state = {
      ...base,
      phase: "match-finished" as const,
      players: [
        {
          ...base.players[0],
          legsWon: 1,
          legHistory: [
            { won: true, turns: [turn([dart(20, 4), dart(20, 4), dart(20, 3)], 501, 281)] },
            { won: false, turns: [turn([dart(20), dart(10), dart(0)], 501, 471)] },
            { won: false, turns: [turn([dart(0), dart(0), dart(0)], 501, 501)] },
          ],
        },
        {
          ...base.players[1],
          legsWon: 2,
          legHistory: [
            { won: false, turns: [turn([dart(20, 2), dart(20, 2), dart(20)], 501, 401)] },
            { won: true, turns: [turn([dart(20), dart(20), dart(3)], 501, 458)] },
          ],
        },
      ] as typeof base.players,
    };

    expect(mapGameStateToResult(state, "Board 1", "2026-09-02T10:15:00Z")).toMatchObject({
      averageHome: 83.3,
      averageGuest: 71.5,
    });
  });
});

describe("helpers", () => {
  it("falls back to Board 1 for an empty board name", () => {
    expect(defaultBoardName("  ")).toBe("Board 1");
    expect(defaultBoardName(" Board 7 ")).toBe("Board 7");
  });

  it("creates a fresh id per call", () => {
    expect(createMatchId()).not.toBe(createMatchId());
  });
});
