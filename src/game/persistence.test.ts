import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BOARD_ID, loadBoardId, saveBoardId } from "./persistence";

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
