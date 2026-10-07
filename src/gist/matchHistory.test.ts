import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import { loadMatchHistory, type MatchHistoryEntry } from "../game/persistence";
import { recordFinishedMatch, setMatchHistoryStatus, uploadHistoryEntry } from "./matchHistory";
import type { GameState } from "../game/types";

const HISTORY_KEY = "darts-quadro-scorer:match-history";

const stubLocalStorage = (initial: Record<string, string> = {}) => {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
  return store;
};

const okFetch = () =>
  vi.fn(async () => ({ ok: true, json: async () => ({ files: {} }) }) as unknown as Response);

// Heim gewinnt 1:0; im abgeschlossenen Leg steht eine 180er-Aufnahme, damit
// Average und Highlights nicht leer sind.
const finishedMatch = (): GameState => {
  const initial = createInitialState("Alice", "Bob", 1);
  const t180 = {
    darts: [
      { segment: 20, multiplier: 3 as const },
      { segment: 20, multiplier: 3 as const },
      { segment: 20, multiplier: 3 as const },
    ],
    scoreBefore: 501,
    scoreAfter: 321,
    bust: false,
  };
  const checkout = {
    darts: [{ segment: 20, multiplier: 2 as const }],
    scoreBefore: 40,
    scoreAfter: 0,
    bust: false,
  };
  return {
    ...initial,
    phase: "match-finished",
    players: [
      {
        ...initial.players[0],
        legsWon: 1,
        remaining: 0,
        legHistory: [{ turns: [t180, { ...t180, scoreBefore: 321, scoreAfter: 141 }, { ...checkout, scoreBefore: 141, scoreAfter: 0 }], won: true }],
      },
      { ...initial.players[1], legHistory: [{ turns: [t180], won: false }] },
    ],
  };
};

const config = { token: "token", gistId: "gist-id" };

describe("local match history", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("records a finished match even when uploads are switched off", () => {
    stubLocalStorage();

    recordFinishedMatch(finishedMatch(), "Board 3", false);
    const [entry] = loadMatchHistory();

    expect(entry).toMatchObject({
      boardName: "Board 3",
      home: "Alice",
      guest: "Bob",
      legsHome: 1,
      legsGuest: 0,
      uploadStatus: "upload-disabled",
    });
    // Dieselben Angaben wie im Gist-Upload: Average und Highlights.
    expect(entry.averageHome).toBeGreaterThan(0);
    expect(entry.highlights).toContain("180 (Alice)");
    expect(entry.updatedAt).toBeTypeOf("string");
  });

  it("marks a match as not uploaded while uploads are enabled", () => {
    stubLocalStorage();

    recordFinishedMatch(finishedMatch(), "Board 1", true);

    expect(loadMatchHistory()[0].uploadStatus).toBe("not-uploaded");
  });

  it("does not add a second entry for the same match after a reload", () => {
    stubLocalStorage();

    const first = recordFinishedMatch(finishedMatch(), "Board 1", true);
    const second = recordFinishedMatch(finishedMatch(), "Board 1", true);

    expect(second).toBe(first);
    expect(loadMatchHistory()).toHaveLength(1);
  });

  it("keeps older matches when a new one is finished", () => {
    const store = stubLocalStorage();

    recordFinishedMatch(finishedMatch(), "Board 1", true);
    // Nächstes Match: die Zuordnung zum laufenden Match verfällt.
    store.delete("darts-quadro-scorer:match-history-id");
    recordFinishedMatch(finishedMatch(), "Board 2", true);

    const entries = loadMatchHistory();
    expect(entries).toHaveLength(2);
    // Neueste zuerst.
    expect(entries[0].boardName).toBe("Board 2");
    expect(entries[1].boardName).toBe("Board 1");
  });

  it("flips the status when the match upload succeeds", () => {
    stubLocalStorage();
    const id = recordFinishedMatch(finishedMatch(), "Board 1", true);

    setMatchHistoryStatus(id, "uploaded");

    expect(loadMatchHistory()[0].uploadStatus).toBe("uploaded");
  });
});

describe("uploading an entry from the history", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const storedEntry = (): MatchHistoryEntry => loadMatchHistory()[0];

  it("uploads a past match and updates its stored status", async () => {
    const store = stubLocalStorage();
    recordFinishedMatch(finishedMatch(), "Board 1", true);
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await uploadHistoryEntry(storedEntry(), config);

    expect(outcome.uploaded).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2); // Gist lesen + schreiben
    expect(storedEntry().uploadStatus).toBe("uploaded");
    // Der Merker des laufenden Matches bleibt unberührt - er gehört nicht
    // zu einem Ergebnis aus der Vergangenheit.
    expect(store.get("darts-quadro-scorer:match-uploaded")).toBeUndefined();
  });

  it("sends the stored result, not the current game state", async () => {
    stubLocalStorage();
    recordFinishedMatch(finishedMatch(), "Board 7", true);
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    await uploadHistoryEntry(storedEntry(), config);

    const [, patchCall] = fetchMock.mock.calls as unknown as [unknown, [string, RequestInit]];
    const body = JSON.parse(String(patchCall[1].body)) as { files: Record<string, { content: string }> };
    const [fileName] = Object.keys(body.files).filter((name) => name.startsWith("board-"));
    const uploaded = JSON.parse(body.files[fileName].content) as Record<string, unknown>;

    expect(fileName).toContain("board-Board-7-");
    expect(uploaded).toMatchObject({
      boardName: "Board 7",
      home: "Alice",
      guest: "Bob",
      legsHome: 1,
      legsGuest: 0,
      status: "finished",
      acknowledged: false,
    });
  });

  it("keeps the entry retryable when the upload fails", async () => {
    stubLocalStorage();
    recordFinishedMatch(finishedMatch(), "Board 1", true);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));

    const failed = await uploadHistoryEntry(storedEntry(), config);

    expect(failed.uploaded).toBe(false);
    expect(failed.failure?.kind).toBe("network");
    expect(storedEntry().uploadStatus).toBe("not-uploaded");

    vi.stubGlobal("fetch", okFetch());
    expect((await uploadHistoryEntry(storedEntry(), config)).uploaded).toBe(true);
    expect(storedEntry().uploadStatus).toBe("uploaded");
  });

  it("fails with a config error when the gist settings are incomplete", async () => {
    stubLocalStorage();
    recordFinishedMatch(finishedMatch(), "Board 1", false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await uploadHistoryEntry(storedEntry(), { token: "token", gistId: "" });

    expect(outcome.failure?.kind).toBe("config");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storedEntry().uploadStatus).toBe("upload-disabled");
  });
});

describe("match history storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("survives a damaged entry in localStorage", () => {
    stubLocalStorage({ [HISTORY_KEY]: "kein json" });

    expect(loadMatchHistory()).toEqual([]);
  });
});
