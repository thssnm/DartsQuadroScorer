import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSetupPlayerNames } from "./playerNames";

describe("loadSetupPlayerNames", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns player names when the optional setup lookup succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          files: {
            "players.json": { content: JSON.stringify({ players: ["Alice", "Bob"] }) },
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadSetupPlayerNames(true, { token: "token", gistId: "gist-id" })
    ).resolves.toEqual(["Alice", "Bob"]);
  });

  it("stays empty and does not fetch when result uploads are disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadSetupPlayerNames(false, { token: "token", gistId: "gist-id" })
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays empty when players.json is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          files: {
            "players.json": { content: JSON.stringify({ players: [] }) },
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadSetupPlayerNames(true, { token: "token", gistId: "gist-id" })
    ).resolves.toEqual([]);
  });

  it("stays empty when the setup lookup fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadSetupPlayerNames(true, { token: "token", gistId: "gist-id" })
    ).resolves.toEqual([]);
  });
});
