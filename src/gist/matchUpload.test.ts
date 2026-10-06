import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import { uploadMatchResult, uploadMatchResultOnce } from "./matchUpload";

const MATCH_UPLOADED_KEY = "darts-quadro-scorer:match-uploaded";

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

const finishedState = () => ({
  ...createInitialState("Alice", "Bob", 1),
  phase: "match-finished" as const,
  players: [
    { ...createInitialState("Alice", "Bob", 1).players[0], legsWon: 1 },
    createInitialState("Alice", "Bob", 1).players[1],
  ],
});

describe("uploadMatchResult", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips the upload path when result uploads are disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMatchResult({
      enabled: false,
      config: { token: "token", gistId: "gist-id" },
      boardId: "Board 1",
      state: finishedState(),
    });

    expect(result).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails without a gist id when result uploads are enabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMatchResult({
      enabled: true,
      config: { token: "token", gistId: "" },
      boardId: "Board 1",
      state: finishedState(),
    });

    expect(result).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const uploadOptions = () => ({
  enabled: true,
  config: { token: "token", gistId: "gist-id" },
  boardId: "Board 1",
  state: finishedState(),
});

describe("uploadMatchResultOnce", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads once and skips the upload after a reload", async () => {
    const store = stubLocalStorage();
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    expect(await uploadMatchResultOnce(uploadOptions())).toBe("uploaded");
    expect(fetchMock).toHaveBeenCalledTimes(2); // Gist lesen + schreiben
    expect(store.get(MATCH_UPLOADED_KEY)).toBe("true");

    // Reload: localStorage überlebt, das Match-Ende-Popup erscheint erneut
    // und wird ein zweites Mal bestätigt.
    fetchMock.mockClear();

    expect(await uploadMatchResultOnce(uploadOptions())).toBe("already-uploaded");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the upload repeatable when the first attempt fails", async () => {
    const store = stubLocalStorage();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));

    expect(await uploadMatchResultOnce(uploadOptions())).toBe("failed");
    expect(store.get(MATCH_UPLOADED_KEY)).toBeUndefined();

    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    expect(await uploadMatchResultOnce(uploadOptions())).toBe("uploaded");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.get(MATCH_UPLOADED_KEY)).toBe("true");
  });

  it("does not remember a skipped upload when result uploads are disabled", async () => {
    const store = stubLocalStorage();
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    expect(await uploadMatchResultOnce({ ...uploadOptions(), enabled: false })).toBe("skipped");
    expect(store.get(MATCH_UPLOADED_KEY)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
