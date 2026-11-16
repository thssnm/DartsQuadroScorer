import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSetupPlayerNames } from "./playerNames";
import { json, loggedIn, stubFetch, stubLocalStorage } from "./testHelpers";

const apiPlayers = (names: string[]) => (url: string) => {
  if (!url.includes("/api/collections/players/records") || !url.includes("perPage=500")) throw new Error(url);
  return json({ items: names.map((name) => ({ name })) });
};

describe("loadSetupPlayerNames", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the names without duplicates in alphabetical order", async () => {
    stubLocalStorage();
    stubFetch(apiPlayers(["Chris", "Alice", "Bob", "Alice"]));

    await expect(loadSetupPlayerNames(true)).resolves.toEqual(["Alice", "Bob", "Chris"]);
  });

  it("sends the stored token when logged in", async () => {
    loggedIn();
    const fetchMock = stubFetch(apiPlayers(["Bob"]));

    await loadSetupPlayerNames(true);

    const [[, init]] = fetchMock.mock.calls;
    expect((init.headers as Record<string, string>).Authorization).toBe("old-token");
  });

  it("leaves the list empty when the API fails", async () => {
    stubLocalStorage();
    stubFetch(() => json({ message: "down" }, 500));

    await expect(loadSetupPlayerNames(true)).resolves.toEqual([]);
  });

  it("leaves the list empty when the API is unreachable", async () => {
    stubLocalStorage();
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });

    await expect(loadSetupPlayerNames(true)).resolves.toEqual([]);
  });

  it("does not ask the API while uploads are switched off", async () => {
    stubLocalStorage();
    const fetchMock = stubFetch(apiPlayers(["Bob"]));

    await expect(loadSetupPlayerNames(false)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
