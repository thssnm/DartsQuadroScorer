import { describe, expect, it } from "vitest";
import { BOOGEY_NUMBERS, isBoogeyNumber, isCheckoutRange, isWithinCheckoutThreshold } from "./checkout";

describe("checkout helpers", () => {
  it("treats scores from 1 to 210 as within the checkout threshold", () => {
    expect(isWithinCheckoutThreshold(0)).toBe(false);
    expect(isWithinCheckoutThreshold(1)).toBe(true);
    expect(isWithinCheckoutThreshold(210)).toBe(true);
    expect(isWithinCheckoutThreshold(211)).toBe(false);
  });

  it("recognizes all configured boogey numbers and rejects others", () => {
    expect(BOOGEY_NUMBERS.size).toBe(16);
    for (const remaining of BOOGEY_NUMBERS) {
      expect(isBoogeyNumber(remaining)).toBe(true);
    }
    expect(isBoogeyNumber(210)).toBe(false);
    expect(isBoogeyNumber(2)).toBe(false);
  });

  it("accepts checkout range scores except configured boogey numbers", () => {
    expect(isCheckoutRange(2)).toBe(true);
    expect(isCheckoutRange(210)).toBe(true);
    expect(isCheckoutRange(209)).toBe(false);
    expect(isCheckoutRange(0)).toBe(false);
    expect(isCheckoutRange(1)).toBe(false);
    expect(isCheckoutRange(211)).toBe(false);
  });
});
