import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import { describeUploadFailure, uploadMatchResult, uploadMatchResultOnce } from "./matchUpload";

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
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("skips the upload path when result uploads are disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await uploadMatchResult({
      enabled: false,
      config: { token: "token", gistId: "gist-id" },
      boardId: "Board 1",
      state: finishedState(),
    });

    expect(outcome).toEqual({ result: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails without a gist id when result uploads are enabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await uploadMatchResult({
      enabled: true,
      config: { token: "token", gistId: "" },
      boardId: "Board 1",
      state: finishedState(),
    });

    expect(outcome.result).toBe("failed");
    expect(outcome.failure?.kind).toBe("config");
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
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uploads once and skips the upload after a reload", async () => {
    const store = stubLocalStorage();
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    expect((await uploadMatchResultOnce(uploadOptions())).result).toBe("uploaded");
    expect(fetchMock).toHaveBeenCalledTimes(2); // Gist lesen + schreiben
    expect(store.get(MATCH_UPLOADED_KEY)).toBe("true");

    // Reload: localStorage überlebt, das Match-Ende-Popup erscheint erneut
    // und wird ein zweites Mal bestätigt.
    fetchMock.mockClear();

    expect((await uploadMatchResultOnce(uploadOptions())).result).toBe("already-uploaded");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the upload repeatable when the first attempt fails", async () => {
    const store = stubLocalStorage();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));

    expect((await uploadMatchResultOnce(uploadOptions())).result).toBe("failed");
    expect(store.get(MATCH_UPLOADED_KEY)).toBeUndefined();

    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    expect((await uploadMatchResultOnce(uploadOptions())).result).toBe("uploaded");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.get(MATCH_UPLOADED_KEY)).toBe("true");
  });

  it("does not remember a skipped upload when result uploads are disabled", async () => {
    const store = stubLocalStorage();
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    expect((await uploadMatchResultOnce({ ...uploadOptions(), enabled: false })).result).toBe(
      "skipped"
    );
    expect(store.get(MATCH_UPLOADED_KEY)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("upload error classification", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports a broken connection as a network error", async () => {
    stubLocalStorage();
    // So lehnt fetch ab, wenn die Anfrage das Gerät nicht verlässt (WLAN weg).
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));

    const outcome = await uploadMatchResultOnce(uploadOptions());

    expect(outcome.result).toBe("failed");
    expect(outcome.failure?.kind).toBe("network");
    expect(describeUploadFailure(outcome.failure!)).toContain("Netzwerkfehler");
  });

  it("reports a rejected request with its http status", async () => {
    stubLocalStorage();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: "Bad credentials" }),
    }) as unknown as Response));

    const outcome = await uploadMatchResultOnce(uploadOptions());

    expect(outcome.failure).toMatchObject({ kind: "http", status: 401, message: "Bad credentials" });
    expect(describeUploadFailure(outcome.failure!)).toContain("401");
  });

  it("falls back to unknown for anything else", async () => {
    stubLocalStorage();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("something odd");
    }));

    const outcome = await uploadMatchResultOnce(uploadOptions());

    expect(outcome.failure?.kind).toBe("unknown");
    expect(describeUploadFailure(outcome.failure!)).toContain("something odd");
  });

  it("logs the cause so a tournament can be analysed afterwards", async () => {
    stubLocalStorage();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));

    await uploadMatchResultOnce(uploadOptions());

    expect(errorLog).toHaveBeenCalledWith(
      "[darts] Gist-Upload fehlgeschlagen:",
      expect.stringContaining("Netzwerkfehler"),
      expect.objectContaining({ kind: "network" })
    );
  });
});

// Der Ablauf aus dem Popup: erster Versuch scheitert, "Upload erneut
// versuchen" schickt denselben Match-Zustand noch einmal.
describe("retrying a failed upload", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("succeeds on the second attempt with the same match data", async () => {
    const store = stubLocalStorage();
    const options = uploadOptions();

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    expect((await uploadMatchResultOnce(options)).result).toBe("failed");
    expect(store.get(MATCH_UPLOADED_KEY)).toBeUndefined();

    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    expect((await uploadMatchResultOnce(options)).result).toBe("uploaded");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.get(MATCH_UPLOADED_KEY)).toBe("true");
  });

  it("stays repeatable when the retry fails as well", async () => {
    const store = stubLocalStorage();
    const options = uploadOptions();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));

    expect((await uploadMatchResultOnce(options)).result).toBe("failed");
    expect((await uploadMatchResultOnce(options)).result).toBe("failed");
    expect(store.get(MATCH_UPLOADED_KEY)).toBeUndefined();
  });
});
