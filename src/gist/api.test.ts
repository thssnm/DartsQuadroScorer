import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import { boardFileName, mapGameStateToBoardFile, uploadFinishedMatchToGist } from "./api";

describe("mapGameStateToBoardFile", () => {
  it("maps a finished match to the dashboard board format", () => {
    const state = {
      ...createInitialState("Alice", "Bob", 2),
      phase: "match-finished" as const,
      players: [
        { ...createInitialState("Alice", "Bob", 2).players[0], name: "Alice", legsWon: 2 },
        { ...createInitialState("Alice", "Bob", 2).players[1], name: "Bob", legsWon: 0 },
      ],
    };

    expect(mapGameStateToBoardFile(state, "Board 1", "2026-09-02T10:15:00Z")).toEqual({
      boardName: "Board 1",
      home: "Alice",
      guest: "Bob",
      legsHome: 2,
      legsGuest: 0,
      status: "finished",
      highlights: [],
      updatedAt: "2026-09-02T10:15:00Z",
      acknowledged: false,
    });
  });
});

describe("uploadFinishedMatchToGist", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads players.json and patches the board file plus merged players", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: {
              "players.json": { content: JSON.stringify({ players: ["Charlie", "Alice"] }) },
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const board = {
      boardName: "Board 1",
      home: "Alice",
      guest: "Bob",
      legsHome: 2,
      legsGuest: 0,
      status: "finished" as const,
      highlights: [],
      updatedAt: "2026-09-02T10:15:00Z",
      acknowledged: false as const,
    };

    await uploadFinishedMatchToGist({ token: " token ", gistId: " gist-id " }, "device-1", board);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.github.com/gists/gist-id", {
      headers: expect.objectContaining({ Authorization: "Bearer token" }),
    });

    const patchRequest = fetchMock.mock.calls[1];
    expect(patchRequest[0]).toBe("https://api.github.com/gists/gist-id");
    expect(patchRequest[1]).toMatchObject({
      method: "PATCH",
      headers: expect.objectContaining({
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      }),
    });

    const body = JSON.parse(patchRequest[1].body as string) as {
      files: Record<string, { content: string }>;
    };
    expect(JSON.parse(body.files[boardFileName("device-1")].content)).toEqual(board);
    expect(JSON.parse(body.files["players.json"].content)).toEqual({
      players: ["Charlie", "Alice", "Bob"],
    });
  });
});
