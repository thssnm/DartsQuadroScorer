import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import type { GameState } from "../game/types";
import {
  IDLE_TARGETS_STATE,
  acknowledgeUploadFailures,
  applyTargetState,
  failedTargets,
  isNewMatchLockedForTargets,
  isUploadPopupVisible,
  runMatchUploadTargets,
  type UploadTarget,
  type UploadTargetsState,
} from "./uploadTargets";
import { apiRoutes, callsTo, gistOk, json, loggedIn, stubFetch, stubLocalStorage, type FetchHandler } from "./testHelpers";

const MATCH_UPLOADED_KEY = "darts-quadro-scorer:match-uploaded";
const MATCH_UPLOADED_API_KEY = "darts-quadro-scorer:match-uploaded-api";

const finishedState = (): GameState => {
  const initial = createInitialState("Alice", "Bob", 1);
  return {
    ...initial,
    phase: "match-finished",
    players: [{ ...initial.players[0], legsWon: 1 }, initial.players[1]],
  };
};

const options = () => ({
  enabled: true,
  gistConfig: { token: "token", gistId: "gist-id" },
  boardId: "Board 1",
  state: finishedState(),
  historyEntryId: null,
});

const gistFails: FetchHandler = () => json({ message: "Bad credentials" }, 401);
const apiFails = apiRoutes({ results: () => json({ message: "boom" }, 500) });

// Sammelt die Zustandswechsel so, wie App.tsx sie in den State schreibt.
const run = async (
  targets: UploadTarget[] = ["gist", "api"],
  initial: UploadTargetsState = IDLE_TARGETS_STATE
): Promise<UploadTargetsState> => {
  let state = initial;
  await runMatchUploadTargets(targets, options(), (target, next) => {
    state = applyTargetState(state, target, next);
  });
  return state;
};

describe("uploading to gist and API", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("unlocks without a popup when both targets succeed", async () => {
    const store = loggedIn();
    const fetchMock = stubFetch(gistOk, apiRoutes());

    const state = await run();

    expect(state.gist.phase).toBe("done");
    expect(state.api.phase).toBe("done");
    expect(isUploadPopupVisible(state)).toBe(false);
    expect(isNewMatchLockedForTargets(state)).toBe(false);
    expect(callsTo(fetchMock, "api.github.com")).toHaveLength(2);
    expect(callsTo(fetchMock, "/results/records")).toHaveLength(1);
    expect(store.get(MATCH_UPLOADED_KEY)).toBe("true");
    expect(store.get(MATCH_UPLOADED_API_KEY)).toBe("true");
  });

  it("reports only the API when the gist worked, and retries only the API", async () => {
    const store = loggedIn();
    stubFetch(gistOk, apiFails);

    const failed = await run();

    expect(failedTargets(failed)).toEqual(["api"]);
    expect(isUploadPopupVisible(failed)).toBe(true);
    expect(isNewMatchLockedForTargets(failed)).toBe(true);
    expect(store.get(MATCH_UPLOADED_KEY)).toBe("true");

    const retryFetch = stubFetch(gistOk, apiRoutes());
    const retried = await run(failedTargets(failed), failed);

    expect(callsTo(retryFetch, "api.github.com")).toHaveLength(0);
    expect(callsTo(retryFetch, "/results/records")).toHaveLength(1);
    expect(isUploadPopupVisible(retried)).toBe(false);
    expect(isNewMatchLockedForTargets(retried)).toBe(false);
  });

  it("reports the gist when it failed and the API worked", async () => {
    const store = loggedIn();
    stubFetch(gistFails, apiRoutes());

    const state = await run();

    expect(failedTargets(state)).toEqual(["gist"]);
    expect(state.gist.failure).toMatchObject({ kind: "http", status: 401 });
    expect(store.get(MATCH_UPLOADED_KEY)).toBeUndefined();
    expect(store.get(MATCH_UPLOADED_API_KEY)).toBe("true");
  });

  it("reports both when both failed and unlocks after acknowledging", async () => {
    loggedIn();
    stubFetch(gistFails, apiFails);

    const state = await run();

    expect(failedTargets(state)).toEqual(["gist", "api"]);
    expect(isNewMatchLockedForTargets(state)).toBe(true);

    const acknowledged = acknowledgeUploadFailures(state);
    expect(isUploadPopupVisible(acknowledged)).toBe(false);
    expect(isNewMatchLockedForTargets(acknowledged)).toBe(false);
  });

  it("skips the API without a login and leaves the gist untouched", async () => {
    const store = stubLocalStorage();
    const fetchMock = stubFetch(gistOk, apiRoutes());

    const state = await run();

    expect(state.api).toEqual({ phase: "done", failure: null });
    expect(isUploadPopupVisible(state)).toBe(false);
    expect(isNewMatchLockedForTargets(state)).toBe(false);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("https://api.github.com"))).toBe(true);
    expect(store.get(MATCH_UPLOADED_KEY)).toBe("true");
    expect(store.get(MATCH_UPLOADED_API_KEY)).toBeUndefined();
  });

  it("keeps the new-match lock until the slower target has finished", async () => {
    loggedIn();
    let releaseApi: (response: Response) => void = () => {};
    const apiResponse = new Promise<Response>((resolve) => {
      releaseApi = resolve;
    });
    let releaseGist: (response: Response) => void = () => {};
    const gistResponse = new Promise<Response>((resolve) => {
      releaseGist = resolve;
    });
    stubFetch(
      () => gistResponse.then(() => json({ files: {} })),
      apiRoutes({ refresh: () => apiResponse })
    );

    let state = IDLE_TARGETS_STATE;
    expect(isNewMatchLockedForTargets(state)).toBe(true);
    const done = runMatchUploadTargets(["gist", "api"], options(), (target, next) => {
      state = applyTargetState(state, target, next);
    });
    expect(isNewMatchLockedForTargets(state)).toBe(true);

    releaseGist(json({}));
    await vi.waitFor(() => expect(state.gist.phase).toBe("done"));
    expect(state.api.phase).toBe("pending");
    expect(isNewMatchLockedForTargets(state)).toBe(true);

    releaseApi(json({ token: "new-token", record: { email: "board@example.com" } }));
    await done;
    expect(state.api.phase).toBe("done");
    expect(isNewMatchLockedForTargets(state)).toBe(false);
  });

  it("shows no popup while the other target is still in its first attempt", () => {
    const state = applyTargetState(
      { gist: { phase: "pending", failure: null }, api: { phase: "pending", failure: null } },
      "api",
      { phase: "failed", failure: { kind: "network", message: "down" } }
    );

    expect(isUploadPopupVisible(state)).toBe(false);
  });
});
