import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import type { Dart, Multiplier, Turn } from "../game/types";
import {
  boardFileName,
  mapGameStateToBoardFile,
  testGistConnection,
  uploadFinishedMatchToGist,
} from "./api";

const dart = (segment: number, multiplier: Multiplier = 1): Dart => ({ segment, multiplier });
const turn = (darts: Dart[], scoreBefore: number, scoreAfter: number, bust = false): Turn => ({
  darts,
  scoreBefore,
  scoreAfter,
  bust,
});

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

  it("maps rounded match averages when players have thrown darts", () => {
    const base = createInitialState("Alice", "Bob", 2);
    const state = {
      ...base,
      phase: "match-finished" as const,
      players: [
        {
          ...base.players[0],
          name: "Alice",
          legsWon: 1,
          legHistory: [
            { won: true, turns: [turn([dart(20, 4), dart(20, 4), dart(20, 3)], 501, 281)] },
            { won: false, turns: [turn([dart(20), dart(10), dart(0)], 501, 471)] },
            { won: false, turns: [turn([dart(0), dart(0), dart(0)], 501, 501)] },
          ],
        },
        {
          ...base.players[1],
          name: "Bob",
          legsWon: 2,
          legHistory: [
            { won: false, turns: [turn([dart(20, 2), dart(20, 2), dart(20)], 501, 401)] },
            { won: true, turns: [turn([dart(20), dart(20), dart(3)], 501, 458)] },
          ],
        },
      ],
    };

    expect(mapGameStateToBoardFile(state, "Board 1", "2026-09-02T10:15:00Z")).toMatchObject({
      averageHome: 83.3,
      averageGuest: 71.5,
    });
  });
});

describe("testGistConnection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports success after a readable Gist response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ files: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(testGistConnection({ token: "token", gistId: "gist-id" })).resolves.toEqual({
      ok: true,
      message: "Verbindung erfolgreich",
    });
  });

  it("reports the GitHub error message after a failed Gist response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(testGistConnection({ token: "token", gistId: "gist-id" })).resolves.toEqual({
      ok: false,
      message: "Bad credentials",
    });
  });
});

describe("uploadFinishedMatchToGist", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads players.json and patches a per-match board file plus merged players", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "match-uuid-1" });
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

    await uploadFinishedMatchToGist({ token: " token ", gistId: " gist-id " }, "Board 1", board);

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
    expect(JSON.parse(body.files[boardFileName("Board 1", "match-uuid-1")].content)).toEqual(board);
    expect(JSON.parse(body.files["players.json"].content)).toEqual({
      players: ["Charlie", "Alice", "Bob"],
    });
  });

  it("uses a fresh board filename for each match upload", async () => {
    let uuidIndex = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => ["match-uuid-1", "match-uuid-2"][uuidIndex++] ?? "match-uuid-extra",
    });
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ files: {} }), { status: 200 }))
      );
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

    await uploadFinishedMatchToGist({ token: "token", gistId: "gist-id" }, "Board 1", board);
    await uploadFinishedMatchToGist({ token: "token", gistId: "gist-id" }, "Board 1", board);

    const firstPatch = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      files: Record<string, { content: string }>;
    };
    const secondPatch = JSON.parse(fetchMock.mock.calls[3][1].body as string) as {
      files: Record<string, { content: string }>;
    };

    expect(firstPatch.files).toHaveProperty(boardFileName("Board 1", "match-uuid-1"));
    expect(secondPatch.files).toHaveProperty(boardFileName("Board 1", "match-uuid-2"));
  });

  it("uses the configured board id instead of the old device id in the board filename", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "match-uuid-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: {} }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const board = {
      boardName: "Board 7",
      home: "Alice",
      guest: "Bob",
      legsHome: 2,
      legsGuest: 0,
      status: "finished" as const,
      highlights: [],
      updatedAt: "2026-09-02T10:15:00Z",
      acknowledged: false as const,
    };

    await uploadFinishedMatchToGist({ token: "token", gistId: "gist-id" }, "Board 7", board);

    const patchRequest = fetchMock.mock.calls[1];
    const body = JSON.parse(patchRequest[1].body as string) as {
      files: Record<string, { content: string }>;
    };

    expect(body.files).toHaveProperty("board-Board-7-match-uuid-1.json");
    expect(body.files).not.toHaveProperty("board-device-1-match-uuid-1.json");
  });
});
