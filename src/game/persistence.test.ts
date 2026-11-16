import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BOARD_ID,
  loadBoardId,
  loadMatchConfirmed,
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
