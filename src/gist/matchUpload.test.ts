import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import { uploadMatchResult } from "./matchUpload";

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
