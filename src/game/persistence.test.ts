import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BOARD_ID,
  loadBoardId,
  loadGameState,
  loadLastBestOf,
  loadLastInputMode,
  loadLocalPlayerNames,
  loadScoreCounts,
  loadMatchConfirmed,
  rememberPlayerNames,
  saveLastBestOf,
  saveLastInputMode,
  saveScoreCounts,
  loadResultUploadEnabled,
  saveBoardId,
  saveMatchConfirmed,
  saveResultUploadEnabled,
} from "./persistence";

const stubLocalStorage = (initial: Record<string, string> = {}) => {
  const store = new Map(Object.entries(initial));
  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };
  vi.stubGlobal("window", { localStorage });
  return localStorage;
};

describe("game state persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("derives bestOf from legsToWin for a state saved before the change", () => {
    stubLocalStorage({
      "darts-quadro-scorer:game-state": JSON.stringify({ phase: "playing", legsToWin: 2, players: [] }),
    });

    const state = loadGameState();

    expect(state?.bestOf).toBe(3);
    expect(state).not.toHaveProperty("legsToWin");
  });

  it("adds score, dartCount, inputMode and scoreDraft to a state saved before the score mode", () => {
    const oldTurn = { darts: [{ segment: 20, multiplier: 3 }, { segment: 20, multiplier: 1 }], scoreBefore: 501, scoreAfter: 421, bust: false };
    stubLocalStorage({
      "darts-quadro-scorer:game-state": JSON.stringify({
        phase: "playing",
        bestOf: 3,
        players: [
          { name: "A", turns: [oldTurn], legHistory: [{ won: true, turns: [oldTurn] }] },
          { name: "B", turns: [], legHistory: [] },
        ],
      }),
    });

    const state = loadGameState();

    expect(state?.inputMode).toBe("darts");
    expect(state?.scoreDraft).toBe("");
    expect(state?.players[0].turns[0]).toMatchObject({ score: 80, dartCount: 2 });
    expect(state?.players[0].legHistory[0].turns[0]).toMatchObject({ score: 80, dartCount: 2 });
  });

  it("keeps a stored bestOf as it is", () => {
    stubLocalStorage({
      "darts-quadro-scorer:game-state": JSON.stringify({ phase: "playing", bestOf: 2, players: [] }),
    });

    expect(loadGameState()?.bestOf).toBe(2);
  });
});

describe("last best-of", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the given default on a fresh device or damaged value", () => {
    stubLocalStorage();
    expect(loadLastBestOf(3)).toBe(3);

    stubLocalStorage({ "darts-quadro-scorer:best-of": "abc" });
    expect(loadLastBestOf(3)).toBe(3);

    stubLocalStorage({ "darts-quadro-scorer:best-of": "0" });
    expect(loadLastBestOf(3)).toBe(3);
  });

  it("returns the value of the last started match", () => {
    stubLocalStorage();

    saveLastBestOf(4);

    expect(loadLastBestOf(3)).toBe(4);
  });
});

describe("input mode and score counts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to single-dart input and stores the last choice", () => {
    stubLocalStorage();
    expect(loadLastInputMode()).toBe("darts");

    saveLastInputMode("score");
    expect(loadLastInputMode()).toBe("score");

    stubLocalStorage({ "darts-quadro-scorer:input-mode": "unsinn" });
    expect(loadLastInputMode()).toBe("darts");
  });

  it("stores score counts and drops damaged entries", () => {
    stubLocalStorage();
    expect(loadScoreCounts()).toEqual({});

    saveScoreCounts({ "140": 2, "26": 1 });
    expect(loadScoreCounts()).toEqual({ "140": 2, "26": 1 });

    stubLocalStorage({ "darts-quadro-scorer:score-frequency": JSON.stringify({ "60": "x", "41": 0, "45": 3 }) });
    expect(loadScoreCounts()).toEqual({ "45": 3 });

    stubLocalStorage({ "darts-quadro-scorer:score-frequency": "[1,2]" });
    expect(loadScoreCounts()).toEqual({});
  });
});

describe("local player names", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("remembers the players of a started match, newest first and without duplicates", () => {
    stubLocalStorage();

    rememberPlayerNames(["Alice", "Bob"]);
    rememberPlayerNames([" Chris ", "Alice"]);

    expect(loadLocalPlayerNames()).toEqual(["Chris", "Alice", "Bob"]);
  });

  it("ignores empty names and caps the list", () => {
    stubLocalStorage();

    rememberPlayerNames(["", "  "]);
    expect(loadLocalPlayerNames()).toEqual([]);

    for (let i = 0; i < 60; i++) rememberPlayerNames([`P${i}`]);
    expect(loadLocalPlayerNames()).toHaveLength(50);
    expect(loadLocalPlayerNames()[0]).toBe("P59");
  });

  it("survives damaged storage", () => {
    stubLocalStorage({ "darts-quadro-scorer:player-names": "kein json" });

    expect(loadLocalPlayerNames()).toEqual([]);
  });
});

describe("board id persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the default board id when none is stored", () => {
    stubLocalStorage();

    expect(loadBoardId()).toBe(DEFAULT_BOARD_ID);
  });

  it("loads a stored board id", () => {
    stubLocalStorage({ "darts-quadro-scorer:board-id": "Board 7" });

    expect(loadBoardId()).toBe("Board 7");
  });

  it("saves a trimmed board id", () => {
    const localStorage = stubLocalStorage();

    saveBoardId(" Board 3 ");

    expect(localStorage.setItem).toHaveBeenCalledWith("darts-quadro-scorer:board-id", "Board 3");
    expect(loadBoardId()).toBe("Board 3");
  });
});

describe("result upload enabled persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to disabled", () => {
    stubLocalStorage();

    expect(loadResultUploadEnabled()).toBe(false);
  });

  it("loads a stored enabled value", () => {
    stubLocalStorage({ "darts-quadro-scorer:result-upload-enabled": "true" });

    expect(loadResultUploadEnabled()).toBe(true);
  });

  it("saves the enabled value", () => {
    const localStorage = stubLocalStorage();

    saveResultUploadEnabled(true);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      "darts-quadro-scorer:result-upload-enabled",
      "true"
    );
    expect(loadResultUploadEnabled()).toBe(true);
  });
});


describe("match confirmed persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to unconfirmed", () => {
    stubLocalStorage();

    expect(loadMatchConfirmed()).toBe(false);
  });

  it("loads a stored confirmation", () => {
    stubLocalStorage({ "darts-quadro-scorer:match-confirmed": "true" });

    expect(loadMatchConfirmed()).toBe(true);
  });

  it("clears the confirmation for a new match", () => {
    stubLocalStorage({ "darts-quadro-scorer:match-confirmed": "true" });

    saveMatchConfirmed(false);

    expect(loadMatchConfirmed()).toBe(false);
  });
});
