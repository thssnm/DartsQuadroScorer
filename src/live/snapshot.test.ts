import { describe, expect, it } from "vitest";
import { createInitialState } from "../game/gameReducer";
import { computePlayerStats } from "../game/stats";
import type { GameState } from "../game/types";
import { buildLiveSnapshot, sameSnapshot } from "./snapshot";
import { beforeCheckout, checkout, playingState, reduce, setSlot, throwTurn } from "./testHelpers";

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
      dartsHome: 0,
      dartsGuest: 0,
      bestOf: 3,
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

describe("buildLiveSnapshot bestOf", () => {
  it("derives the match length from legsToWin", () => {
    expect(buildLiveSnapshot(playingState(1), "B", "m").bestOf).toBe(1);
    expect(buildLiveSnapshot(playingState(3), "B", "m").bestOf).toBe(5);
    expect(buildLiveSnapshot(checkout(beforeCheckout(4)), "B", "m").bestOf).toBe(7);
  });
});

describe("buildLiveSnapshot dartsHome/dartsGuest", () => {
  const darts = (state: GameState) => {
    const { dartsHome, dartsGuest } = buildLiveSnapshot(state, "B", "m");
    return [dartsHome, dartsGuest];
  };

  it("counts three darts per turn, also for 0 points and empty confirmed slots", () => {
    let state = throwTurn(playingState(), [[20, 3], [20], [6]]);
    expect(darts(state)).toEqual([3, 0]);

    state = throwTurn(state, [[0], [0], [0]]);
    expect(darts(state)).toEqual([3, 3]);

    // Aufnahme ohne einen einzigen eingegebenen Dart.
    state = reduce(state, { type: "CONFIRM_TURN" });
    expect(darts(state)).toEqual([6, 3]);
  });

  it("counts three darts for a bust", () => {
    // Heim steht auf 40, T20 überwirft.
    const state = throwTurn(beforeCheckout(2), [[20, 3]]);

    expect(state.players[0].remaining).toBe(40);
    expect(darts(state)).toEqual([12, 9]);
  });

  it("counts only the darts up to the checkout double", () => {
    const one = checkout(beforeCheckout(2));
    const two = throwTurn(beforeCheckout(2), [[20], [10, 2]]);
    const three = throwTurn(beforeCheckout(2), [[10], [10], [10, 2]]);

    for (const state of [one, two, three]) expect(state.phase).toBe("leg-finished");
    expect(darts(one)).toEqual([10, 9]);
    expect(darts(two)).toEqual([11, 9]);
    expect(darts(three)).toEqual([12, 9]);
  });

  it("keeps the leg count at the end of the match next to the winner's 0", () => {
    const snapshot = buildLiveSnapshot(checkout(beforeCheckout(1)), "B", "m", true);

    expect(snapshot).toMatchObject({ scoreHome: 0, dartsHome: 10, dartsGuest: 9, status: "finished" });
  });

  it("resets both counts to 0 with the next leg", () => {
    const state = reduce(checkout(beforeCheckout(2)), { type: "NEXT_LEG" });

    expect(darts(state)).toEqual([0, 0]);
    expect(darts(throwTurn(state, [[20], [20], [20]]))).toEqual([0, 3]);
  });

  it("follows UNDO_LAST_TURN", () => {
    const state = throwTurn(throwTurn(playingState(), [[20], [20], [20]]), [[19], [19], [19]]);

    expect(darts(reduce(state, { type: "UNDO_LAST_TURN" }))).toEqual([3, 0]);
  });

  it("follows UNDO_LEG_RESULT and a corrected checkout", () => {
    let state = reduce(checkout(beforeCheckout(2)), { type: "UNDO_LEG_RESULT" });
    expect(state.phase).toBe("playing");
    expect(darts(state)).toEqual([10, 9]);

    // Checkout nachträglich auf zwei Darts korrigiert: S20, D10.
    state = reduce(state, { type: "EDIT_TURN", playerIndex: 0, turnIndex: 3 });
    state = setSlot(reduce(state, { type: "CLEAR_SLOT", index: 0 }), 0, 20);
    state = setSlot(state, 1, 10, 2);
    state = reduce(state, { type: "CONFIRM_EDIT" });

    expect(state.phase).toBe("leg-finished");
    expect(darts(state)).toEqual([11, 9]);
  });
});

describe("sameSnapshot", () => {
  it("compares by value", () => {
    const a = buildLiveSnapshot(playingState(), "B", "m");

    expect(sameSnapshot(a, { ...a })).toBe(true);
    expect(sameSnapshot(a, { ...a, scoreHome: 400 })).toBe(false);
    expect(sameSnapshot(a, { ...a, averageHome: 50 })).toBe(false);
    expect(sameSnapshot(a, { ...a, dartsGuest: 3 })).toBe(false);
    expect(sameSnapshot(a, null)).toBe(false);
  });
});
