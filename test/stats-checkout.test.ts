import assert from "node:assert/strict";
import test from "node:test";
import { isBoogeyNumber, isCheckoutRange, isWithinCheckoutThreshold } from "../src/game/checkout.ts";
import { computePlayerStats } from "../src/game/stats.ts";
import type { Dart, Multiplier, PlayerState, Turn } from "../src/game/types.ts";

const dart = (segment: number, multiplier: Multiplier = 1): Dart => ({ segment, multiplier });
const turn = (darts: Dart[], bust = false): Turn => ({
  darts,
  scoreBefore: 501,
  scoreAfter: 501,
  bust,
});

test("checkout helpers distinguish range, threshold, and boogey numbers", () => {
  assert.equal(isCheckoutRange(210), true);
  assert.equal(isCheckoutRange(209), false);
  assert.equal(isBoogeyNumber(209), true);
  assert.equal(isWithinCheckoutThreshold(209), true);
  assert.equal(isWithinCheckoutThreshold(211), false);
});

test("computePlayerStats counts bust darts as thrown without scoring them", () => {
  const player: PlayerState = {
    name: "A",
    remaining: 261,
    turns: [turn([dart(20, 4), dart(20, 4), dart(20, 4)]), turn([dart(20, 4)], true)],
    legsWon: 1,
    legHistory: [
      {
        won: true,
        turns: [turn([dart(20, 4), dart(20, 4), dart(20, 4)]), turn([dart(20, 2)])],
      },
      {
        won: false,
        turns: [turn([dart(20), dart(20), dart(20)])],
      },
    ],
  };

  const stats = computePlayerStats(player);

  assert.equal(stats.count240, 2);
  assert.equal(stats.count180Plus, 2);
  assert.equal(stats.count140Plus, 2);
  assert.deepEqual(stats.bestLeg, { darts: 4 });
  assert.equal(stats.legAverage, 180);
});
