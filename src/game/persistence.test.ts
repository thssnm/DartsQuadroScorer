import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BOARD_ID,
  loadBoardId,
  loadGistId,
  loadResultUploadEnabled,
  saveBoardId,
  saveGistId,
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

describe("gist id persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to an empty gist id when none is stored", () => {
    stubLocalStorage();

    expect(loadGistId()).toBe("");
  });

  it("loads a stored gist id", () => {
    stubLocalStorage({ "darts-quadro-scorer:gist-id": "gist-123" });

    expect(loadGistId()).toBe("gist-123");
  });

  it("saves a trimmed gist id", () => {
    const localStorage = stubLocalStorage();

    saveGistId(" gist-456 ");

    expect(localStorage.setItem).toHaveBeenCalledWith("darts-quadro-scorer:gist-id", "gist-456");
    expect(loadGistId()).toBe("gist-456");
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
