import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import { loadMatchHistory, type MatchHistoryEntry } from "../game/persistence";
import type { GameState } from "../game/types";
import { recordFinishedMatch } from "../gist/matchHistory";
import { POCKETBASE_URL } from "./client";
import {
  describeApiUploadFailure,
  ensureApiHistoryFields,
  uploadApiMatchResultOnce,
  uploadHistoryEntryToApi,
} from "./matchUpload";
import {
  API_TOKEN_KEY,
  apiRoutes,
  bodyOf,
  callsTo,
  gistOk,
  json,
  loggedIn,
  stubFetch,
  stubLocalStorage,
} from "./testHelpers";

const MATCH_UPLOADED_API_KEY = "darts-quadro-scorer:match-uploaded-api";
const HISTORY_KEY = "darts-quadro-scorer:match-history";

const finishedState = (): GameState => {
  const initial = createInitialState("Alice", "Bob", 1);
  return {
    ...initial,
    phase: "match-finished",
    players: [{ ...initial.players[0], legsWon: 1 }, initial.players[1]],
  };
};

// Legt wie beim Bestätigen des Matches den Historie-Eintrag samt matchId an.
const recordMatch = (): string => {
  const id = recordFinishedMatch(finishedState(), "Board 2", true);
  ensureApiHistoryFields(id);
  return id;
};

const options = (historyEntryId: string | null) => ({
  enabled: true,
  boardId: "Board 2",
  state: finishedState(),
  historyEntryId,
});

const uniqueViolation = () =>
  json(
    {
      code: 400,
      message: "Failed to create record.",
      data: { matchId: { code: "validation_not_unique", message: "Value must be unique." } },
    },
    400
  );

describe("API upload of the finished match", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refreshes the token first and sends the result with the raw token", async () => {
    const store = loggedIn();
    const id = recordMatch();
    const fetchMock = stubFetch(gistOk, apiRoutes());

    const outcome = await uploadApiMatchResultOnce(options(id));

    expect(outcome.result).toBe("uploaded");
    const [refresh] = callsTo(fetchMock, "/auth-refresh");
    expect(refresh[0]).toBe(`${POCKETBASE_URL}/api/collections/users/auth-refresh`);
    expect((refresh[1].headers as Record<string, string>).Authorization).toBe("old-token");
    expect(store.get(API_TOKEN_KEY)).toBe("new-token");

    const [result] = callsTo(fetchMock, "/results/records");
    expect((result[1].headers as Record<string, string>).Authorization).toBe("new-token");
    const body = bodyOf(result);
    expect(body).toMatchObject({
      matchId: loadMatchHistory()[0].matchId,
      boardName: "Board 2",
      home: "Alice",
      guest: "Bob",
      legsHome: 1,
      legsGuest: 0,
      highlights: [],
    });
    expect(typeof body.playedAt).toBe("string");
    expect(body).not.toHaveProperty("acknowledged");

    expect(store.get(MATCH_UPLOADED_API_KEY)).toBe("true");
    expect(loadMatchHistory()[0].apiUploadStatus).toBe("uploaded");
  });

  it("adds both players best effort and ignores their errors", async () => {
    loggedIn();
    const id = recordMatch();
    const fetchMock = stubFetch(gistOk, apiRoutes({ players: () => uniqueViolation() }));

    expect((await uploadApiMatchResultOnce(options(id))).result).toBe("uploaded");
    expect(callsTo(fetchMock, "/players/records").map(bodyOf)).toEqual([{ name: "Alice" }, { name: "Bob" }]);
  });

  it("is skipped without a login - no request, no error", async () => {
    const store = stubLocalStorage();
    const fetchMock = stubFetch(gistOk, apiRoutes());

    expect(await uploadApiMatchResultOnce(options(null))).toEqual({ result: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get(MATCH_UPLOADED_API_KEY)).toBeUndefined();
  });

  it("is skipped when result uploads are switched off", async () => {
    loggedIn();
    const fetchMock = stubFetch(gistOk, apiRoutes());

    expect((await uploadApiMatchResultOnce({ ...options(null), enabled: false })).result).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails with a re-login hint when the refresh is rejected with 401", async () => {
    const store = loggedIn();
    const id = recordMatch();
    const fetchMock = stubFetch(
      gistOk,
      apiRoutes({ refresh: () => json({ code: 401, message: "The request requires valid record authorization token." }, 401) })
    );

    const outcome = await uploadApiMatchResultOnce(options(id));

    expect(outcome.result).toBe("failed");
    expect(outcome.failure).toMatchObject({ kind: "http", status: 401 });
    expect(callsTo(fetchMock, "/results/records")).toHaveLength(0);
    expect(store.get(MATCH_UPLOADED_API_KEY)).toBeUndefined();
    expect(describeApiUploadFailure(outcome.failure!)).toContain("in den Einstellungen neu anmelden");
  });

  it("counts a unique violation on matchId as already uploaded", async () => {
    const store = loggedIn();
    const id = recordMatch();
    stubFetch(gistOk, apiRoutes({ results: () => uniqueViolation() }));

    expect((await uploadApiMatchResultOnce(options(id))).result).toBe("uploaded");
    expect(store.get(MATCH_UPLOADED_API_KEY)).toBe("true");
    expect(loadMatchHistory()[0].apiUploadStatus).toBe("uploaded");
  });

  it("treats any other 400 - also with empty data - as failed", async () => {
    const store = loggedIn();
    const id = recordMatch();
    stubFetch(gistOk, apiRoutes({ results: () => json({ code: 400, message: "Failed to create record.", data: {} }, 400) }));

    const outcome = await uploadApiMatchResultOnce(options(id));

    expect(outcome.failure).toMatchObject({ kind: "http", status: 400 });
    expect(store.get(MATCH_UPLOADED_API_KEY)).toBeUndefined();
    expect(loadMatchHistory()[0].apiUploadStatus).toBe("not-uploaded");
  });

  it("classifies a broken connection as a network error", async () => {
    loggedIn();
    stubFetch(gistOk, () => {
      throw new TypeError("Failed to fetch");
    });

    expect((await uploadApiMatchResultOnce(options(null))).failure?.kind).toBe("network");
  });

  it("does not upload twice once the API flag is set", async () => {
    loggedIn({ [MATCH_UPLOADED_API_KEY]: "true" });
    const fetchMock = stubFetch(gistOk, apiRoutes());

    expect((await uploadApiMatchResultOnce(options(null))).result).toBe("already-uploaded");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("matchId", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stays the same for the retry and the history button", async () => {
    loggedIn();
    const id = recordMatch();
    const matchId = loadMatchHistory()[0].matchId;
    expect(matchId).toBeTypeOf("string");

    // Erster Versuch scheitert, der Retry geht durch.
    const failing = stubFetch(gistOk, apiRoutes({ results: () => json({ message: "boom" }, 500) }));
    await uploadApiMatchResultOnce(options(id));
    const retrying = stubFetch(gistOk, apiRoutes());
    await uploadApiMatchResultOnce(options(id));
    // Der Historie-Button schickt dieselbe ID noch einmal.
    const fromHistory = stubFetch(gistOk, apiRoutes({ results: () => uniqueViolation() }));
    const outcome = await uploadHistoryEntryToApi(loadMatchHistory()[0]);

    expect(outcome.uploaded).toBe(true);
    const sentIds = [failing, retrying, fromHistory].map(
      (mock) => bodyOf(callsTo(mock, "/results/records")[0]).matchId
    );
    expect(sentIds).toEqual([matchId, matchId, matchId]);
  });

  it("keeps the matchId when the match is recorded again after a reload", () => {
    stubLocalStorage();
    const id = recordMatch();
    const first = loadMatchHistory()[0].matchId;

    expect(ensureApiHistoryFields(recordFinishedMatch(finishedState(), "Board 2", true))).toBe(first);
    expect(id).toBe(loadMatchHistory()[0].id);
  });

  it("gives an old history entry a matchId on its first API attempt and stores it", async () => {
    const oldEntry: MatchHistoryEntry = {
      id: "old-1",
      boardName: "Board 1",
      home: "Alice",
      guest: "Bob",
      legsHome: 2,
      legsGuest: 0,
      highlights: [],
      updatedAt: "2026-09-01T18:00:00.000Z",
      uploadStatus: "uploaded",
    };
    loggedIn({ [HISTORY_KEY]: JSON.stringify([oldEntry]) });
    const failing = stubFetch(gistOk, apiRoutes({ results: () => json({ message: "boom" }, 500) }));

    expect((await uploadHistoryEntryToApi(oldEntry)).uploaded).toBe(false);
    const stored = loadMatchHistory()[0];
    expect(stored.matchId).toBeTypeOf("string");
    expect(stored.apiUploadStatus).toBe("not-uploaded");
    expect(bodyOf(callsTo(failing, "/results/records")[0]).matchId).toBe(stored.matchId);
    // playedAt ist der ursprüngliche Zeitpunkt, nicht der des Uploads.
    expect(bodyOf(callsTo(failing, "/results/records")[0]).playedAt).toBe(oldEntry.updatedAt);

    const retry = stubFetch(gistOk, apiRoutes());
    expect((await uploadHistoryEntryToApi(oldEntry)).uploaded).toBe(true);
    expect(bodyOf(callsTo(retry, "/results/records")[0]).matchId).toBe(stored.matchId);
    expect(loadMatchHistory()[0].apiUploadStatus).toBe("uploaded");
  });

  it("refuses a history upload without a login", async () => {
    stubLocalStorage();
    const fetchMock = stubFetch(gistOk, apiRoutes());

    expect(await uploadHistoryEntryToApi({ id: "x" } as MatchHistoryEntry)).toMatchObject({
      uploaded: false,
      failure: { kind: "config" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
