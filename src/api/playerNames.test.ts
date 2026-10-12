import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAllSetupPlayerNames } from "./playerNames";
import { json, stubFetch, stubLocalStorage } from "./testHelpers";

const gistConfig = { token: "token", gistId: "gist-id" };

const gistPlayers = (players: string[]) => () =>
  json({ files: { "players.json": { content: JSON.stringify({ players }) } } });

const apiPlayers = (names: string[]) => (url: string) => {
  if (!url.includes("/api/collections/players/records") || !url.includes("perPage=500")) throw new Error(url);
  return json({ items: names.map((name) => ({ name })) });
};

describe("loadAllSetupPlayerNames", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges both sources without duplicates in alphabetical order", async () => {
    stubLocalStorage();
    stubFetch(gistPlayers(["Chris", "Alice"]), apiPlayers(["Bob", "Alice", "Dana"]));

    await expect(loadAllSetupPlayerNames(true, gistConfig)).resolves.toEqual(["Alice", "Bob", "Chris", "Dana"]);
  });

  it("keeps the gist names when the API fails", async () => {
    stubLocalStorage();
    stubFetch(gistPlayers(["Chris", "Alice"]), () => json({ message: "down" }, 500));

    await expect(loadAllSetupPlayerNames(true, gistConfig)).resolves.toEqual(["Alice", "Chris"]);
  });

  it("keeps the API names when the gist is unreachable", async () => {
    stubLocalStorage();
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    }, apiPlayers(["Bob"]));

    await expect(loadAllSetupPlayerNames(true, gistConfig)).resolves.toEqual(["Bob"]);
  });

  it("does not ask either source while uploads are switched off", async () => {
    stubLocalStorage();
    const fetchMock = stubFetch(gistPlayers(["Alice"]), apiPlayers(["Bob"]));

    await expect(loadAllSetupPlayerNames(false, gistConfig)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
