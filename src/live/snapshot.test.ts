import { describe, expect, it } from "vitest";
import { createInitialState } from "../game/gameReducer";
import { computePlayerStats } from "../game/stats";
import { buildLiveSnapshot, sameSnapshot } from "./snapshot";
import { beforeCheckout, checkout, playingState, reduce, throwTurn } from "./testHelpers";

describe("buildLiveSnapshot", () => {
  it("maps a fresh match to 501:501 without averages", () => {
    const snapshot = buildLiveSnapshot(playingState(), "Board 3", "m-1");

    expect(snapshot).toEqual({
      matchId: "m-1",
      boardName: "Board 3",
      home: "Alice",
      guest: "Bob",
      legsHome: 0,
      legsGuest: 0,
      scoreHome: 501,
      scoreGuest: 501,
      activePlayer: "home",
      status: "live",
    });
  });

  it("takes the remaining scores, the active player and the rounded match average", () => {
    // 60 + 26 = 86 Punkte mit 3 Darts -> Ø 86; Gast danach am Zug.
    const state = throwTurn(playingState(), [[20, 3], [20], [6]]);
    const snapshot = buildLiveSnapshot(state, "Board 3", "m-1");

    expect(snapshot.scoreHome).toBe(415);
    expect(snapshot.scoreGuest).toBe(501);
    expect(snapshot.activePlayer).toBe("guest");
    expect(snapshot.averageHome).toBe(86);
    expect(snapshot).not.toHaveProperty("averageGuest");
  });

  it("rounds the average to one decimal like the match statistics", () => {
    const state = beforeCheckout(2);
    const snapshot = buildLiveSnapshot(state, "B", "m");
    const expected = Math.round(computePlayerStats(state.players[0]).matchAverage * 10) / 10;

    expect(snapshot.averageHome).toBe(expected);
    expect(snapshot.averageGuest).toBe(60);
  });

  it("sends an average of 0 once darts have been thrown", () => {
    const state = throwTurn(playingState(), [[0], [0], [0]]);

    expect(buildLiveSnapshot(state, "B", "m").averageHome).toBe(0);
  });

  it("counts won legs", () => {
    const state = checkout(beforeCheckout(2));
    expect(state.phase).toBe("leg-finished");

    const snapshot = buildLiveSnapshot(state, "B", "m");
    expect(snapshot.legsHome).toBe(1);
    expect(snapshot.legsGuest).toBe(0);
  });

  it("stays live in the leg and match popups and finishes only after the confirmation", () => {
    const legFinished = checkout(beforeCheckout(2));
    const matchFinished = checkout(beforeCheckout(1));

    expect(buildLiveSnapshot(legFinished, "B", "m").status).toBe("live");
    expect(buildLiveSnapshot(matchFinished, "B", "m").status).toBe("live");
    expect(buildLiveSnapshot(matchFinished, "B", "m", true).status).toBe("finished");
    // "Rückgängig" holt das Match zurück ins Spiel.
    const undone = reduce(matchFinished, { type: "UNDO_LEG_RESULT" });
    expect(buildLiveSnapshot(undone, "B", "m", false).status).toBe("live");
  });

  it("uses players[0] as home and players[1] as guest", () => {
    const state = { ...createInitialState("Heim-Name", "Gast-Name", 2), phase: "playing" as const };
    const snapshot = buildLiveSnapshot(state, "B", "m");

    expect(snapshot.home).toBe("Heim-Name");
    expect(snapshot.guest).toBe("Gast-Name");
  });
});

describe("sameSnapshot", () => {
  it("compares by value", () => {
    const a = buildLiveSnapshot(playingState(), "B", "m");

    expect(sameSnapshot(a, { ...a })).toBe(true);
    expect(sameSnapshot(a, { ...a, scoreHome: 400 })).toBe(false);
    expect(sameSnapshot(a, { ...a, averageHome: 50 })).toBe(false);
    expect(sameSnapshot(a, null)).toBe(false);
  });
});
