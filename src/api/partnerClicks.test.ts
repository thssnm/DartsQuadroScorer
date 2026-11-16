import { afterEach, describe, expect, it, vi } from "vitest";
import { POCKETBASE_URL } from "./client";
import { PARTNER_URL, countPartnerClick } from "./partnerClicks";
import { bodyOf, json, stubFetch } from "./testHelpers";

describe("partner link", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("carries UTM parameters for the partner's analytics", () => {
    const url = new URL(PARTNER_URL);

    expect(url.hostname).toBe("lovefordarts.de");
    expect(url.searchParams.get("utm_source")).toBe("quadro-scorer");
    expect(url.searchParams.get("utm_medium")).toBe("app");
  });

  it("records one click with the board name and without any token", () => {
    const fetchMock = stubFetch(() => json({ id: "c1" }));

    countPartnerClick("  Board 2  ");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [call] = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(call[0]).toBe(`${POCKETBASE_URL}/api/collections/partner_clicks/records`);
    expect(call[1].method).toBe("POST");
    expect(call[1].headers).not.toHaveProperty("Authorization");
    expect(bodyOf(call)).toEqual({ boardName: "Board 2" });
  });

  it("caps an overlong board name", () => {
    const fetchMock = stubFetch(() => json({ id: "c1" }));

    countPartnerClick("x".repeat(500));

    const [call] = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect((bodyOf(call).boardName as string).length).toBe(100);
  });

  it("never throws, neither on a rejected request nor on an error response", async () => {
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    expect(() => countPartnerClick("Board 1")).not.toThrow();

    stubFetch(() => json({ message: "Forbidden" }, 403));
    expect(() => countPartnerClick("Board 1")).not.toThrow();

    vi.stubGlobal("fetch", () => {
      throw new Error("sync");
    });
    expect(() => countPartnerClick("Board 1")).not.toThrow();
    // Offene Promises sollen keinen unbehandelten Fehler hinterlassen.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
