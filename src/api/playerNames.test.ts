import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSetupPlayerNames } from "./playerNames";
import { json, loggedIn, stubFetch, stubLocalStorage } from "./testHelpers";

const PLAYER_NAMES_KEY = "darts-quadro-scorer:player-names";

const apiPlayers = (names: string[]) => (url: string) => {
  if (!url.includes("/api/collections/players/records") || !url.includes("perPage=500")) throw new Error(url);
  return json({ items: names.map((name) => ({ name })) });
};

const localNames = (names: string[]) => ({ [PLAYER_NAMES_KEY]: JSON.stringify(names) });

describe("loadSetupPlayerNames while logged in", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns only the API names, sorted and without duplicates", async () => {
    loggedIn(localNames(["Lokal"]));
    const fetchMock = stubFetch(apiPlayers(["Chris", "Alice", "Bob", "Alice"]));

    await expect(loadSetupPlayerNames()).resolves.toEqual(["Alice", "Bob", "Chris"]);
    const [[, init]] = fetchMock.mock.calls;
    expect((init.headers as Record<string, string>).Authorization).toBe("old-token");
  });

  it("leaves the list empty when the API fails - no fallback to local names", async () => {
    loggedIn(localNames(["Lokal"]));
    stubFetch(() => json({ message: "down" }, 500));

    await expect(loadSetupPlayerNames()).resolves.toEqual([]);
  });

  it("leaves the list empty when the API is unreachable", async () => {
    loggedIn(localNames(["Lokal"]));
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });

    await expect(loadSetupPlayerNames()).resolves.toEqual([]);
  });
});

describe("loadSetupPlayerNames while logged out", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the locally remembered names without any request", async () => {
    stubLocalStorage(localNames(["Chris", "Alice"]));
    const fetchMock = stubFetch(apiPlayers(["Bob"]));

    await expect(loadSetupPlayerNames()).resolves.toEqual(["Alice", "Chris"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is empty on a fresh device", async () => {
    stubLocalStorage();
    stubFetch(apiPlayers(["Bob"]));

    await expect(loadSetupPlayerNames()).resolves.toEqual([]);
  });
});
