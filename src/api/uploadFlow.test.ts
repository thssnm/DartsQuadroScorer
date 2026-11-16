import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import type { GameState } from "../game/types";
import { runApiUploadFlow } from "./matchUpload";
import {
  IDLE_UPLOAD_STATE,
  acknowledgeUploadFailure,
  applyUploadState,
  isNewMatchLocked,
  isUploadPopupVisible,
  isUploadRetrying,
  type UploadFlowState,
} from "./uploadFlow";
import { apiRoutes, callsTo, json, loggedIn, stubFetch, stubLocalStorage } from "./testHelpers";

const MATCH_UPLOADED_API_KEY = "darts-quadro-scorer:match-uploaded-api";

const finishedState = (): GameState => {
  const initial = createInitialState("Alice", "Bob", 1);
  return {
    ...initial,
    phase: "match-finished",
    players: [{ ...initial.players[0], legsWon: 1 }, initial.players[1]],
  };
};

const options = () => ({ enabled: true, boardId: "Board 1", state: finishedState(), historyEntryId: null });

const apiFails = apiRoutes({ results: () => json({ message: "boom" }, 500) });

// Sammelt die Zustandswechsel so, wie App.tsx sie in den State schreibt.
const run = async (initial: UploadFlowState = IDLE_UPLOAD_STATE): Promise<UploadFlowState> => {
  let state = initial;
  await runApiUploadFlow(options(), (next) => {
    state = applyUploadState(state, next);
  });
  return state;
};

describe("upload flow of the confirmed match", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("unlocks without a popup after a successful upload", async () => {
    const store = loggedIn();
    const fetchMock = stubFetch(apiRoutes());

    const state = await run();

    expect(state).toEqual({ phase: "done", failure: null });
    expect(isUploadPopupVisible(state)).toBe(false);
    expect(isNewMatchLocked(state)).toBe(false);
    expect(callsTo(fetchMock, "/results/records")).toHaveLength(1);
    expect(store.get(MATCH_UPLOADED_API_KEY)).toBe("true");
  });

  it("shows the popup and keeps the lock after a failure, retries, then unlocks", async () => {
    const store = loggedIn();
    stubFetch(apiFails);

    const failed = await run();

    expect(failed.phase).toBe("failed");
    expect(failed.failure).toMatchObject({ kind: "http", status: 500 });
    expect(isUploadPopupVisible(failed)).toBe(true);
    expect(isNewMatchLocked(failed)).toBe(true);
    expect(store.get(MATCH_UPLOADED_API_KEY)).toBeUndefined();

    const retryFetch = stubFetch(apiRoutes());
    const retried = await run(failed);

    expect(callsTo(retryFetch, "/results/records")).toHaveLength(1);
    expect(isUploadPopupVisible(retried)).toBe(false);
    expect(isNewMatchLocked(retried)).toBe(false);
    expect(store.get(MATCH_UPLOADED_API_KEY)).toBe("true");
  });

  it("keeps the known failure visible while the retry is pending", () => {
    const failed: UploadFlowState = { phase: "failed", failure: { kind: "network", message: "down" } };

    const retrying = applyUploadState(failed, { phase: "pending", failure: null });

    expect(retrying.failure).toEqual(failed.failure);
    expect(isUploadPopupVisible(retrying)).toBe(true);
    expect(isUploadRetrying(retrying)).toBe(true);
  });

  it("unlocks after acknowledging the failure", async () => {
    loggedIn();
    stubFetch(apiFails);

    const acknowledged = acknowledgeUploadFailure(await run());

    expect(acknowledged).toEqual({ phase: "acknowledged", failure: null });
    expect(isUploadPopupVisible(acknowledged)).toBe(false);
    expect(isNewMatchLocked(acknowledged)).toBe(false);
  });

  it("skips without a login - no request, no popup, no lock", async () => {
    const store = stubLocalStorage();
    const fetchMock = stubFetch(apiRoutes());

    const state = await run();

    expect(state).toEqual({ phase: "done", failure: null });
    expect(isUploadPopupVisible(state)).toBe(false);
    expect(isNewMatchLocked(state)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get(MATCH_UPLOADED_API_KEY)).toBeUndefined();
  });

  it("keeps the new-match lock until the upload promise has resolved", async () => {
    loggedIn();
    let release: (response: Response) => void = () => {};
    const refreshResponse = new Promise<Response>((resolve) => {
      release = resolve;
    });
    stubFetch(apiRoutes({ refresh: () => refreshResponse }));

    let state = IDLE_UPLOAD_STATE;
    expect(isNewMatchLocked(state)).toBe(true);
    const done = runApiUploadFlow(options(), (next) => {
      state = applyUploadState(state, next);
    });
    expect(state.phase).toBe("pending");
    expect(isNewMatchLocked(state)).toBe(true);

    release(json({ token: "new-token", record: { email: "board@example.com" } }));
    await done;
    expect(state.phase).toBe("done");
    expect(isNewMatchLocked(state)).toBe(false);
  });
});
