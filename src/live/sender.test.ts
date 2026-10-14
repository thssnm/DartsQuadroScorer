import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import type { GameState } from "../game/types";
import { POCKETBASE_URL } from "../api/client";
import { API_TOKEN_KEY, json, loggedIn, stubLocalStorage } from "../api/testHelpers";
import { LiveScoreSender, describeLiveSendStatus, type LiveObservation } from "./sender";
import { beforeCheckout, checkout, playingState, reduce, throwTurn } from "./testHelpers";

const SESSION_KEY = "darts-quadro-scorer:livescore-session";
const RECORDS_URL = `${POCKETBASE_URL}/api/collections/livescore/records`;
const MATCH_UPLOADED_KEY = "darts-quadro-scorer:match-uploaded";
const MATCH_UPLOADED_API_KEY = "darts-quadro-scorer:match-uploaded-api";

type Call = [string, RequestInit];
type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

const livescoreOk: Handler = (url, init) => {
  if (url.includes("/users/auth-refresh")) return json({ token: "new-token", record: { email: "board@example.com" } });
  if (init.method === "POST") return json({ id: "rec-1" });
  if (init.method === "PATCH") return json({ id: url.split("/").at(-1) });
  return json({ items: [] });
};

const stubFetch = (handler: Handler = livescoreOk) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => handler(String(input), init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const calls = (fetchMock: ReturnType<typeof stubFetch>): Call[] => fetchMock.mock.calls as unknown as Call[];
const livescoreCalls = (fetchMock: ReturnType<typeof stubFetch>): Call[] =>
  calls(fetchMock).filter(([url]) => url.startsWith(RECORDS_URL));
const bodyOf = (call: Call): Record<string, unknown> => JSON.parse(String(call[1].body)) as Record<string, unknown>;
const methods = (fetchMock: ReturnType<typeof stubFetch>): string[] =>
  livescoreCalls(fetchMock).map(([, init]) => init.method ?? "GET");

const observation = (state: GameState, overrides: Partial<LiveObservation> = {}): LiveObservation => ({
  state,
  matchConfirmed: false,
  boardId: "Board 2",
  enabled: true,
  token: "old-token",
  ...overrides,
});

const session = (store: Map<string, string>) =>
  store.has(SESSION_KEY) ? (JSON.parse(store.get(SESSION_KEY)!) as { matchId: string; recordId?: string }) : null;

const unique = () =>
  json({ code: 400, message: "Failed", data: { matchId: { code: "validation_not_unique", message: "unique" } } }, 400);

const abortable = (_url: string, init: RequestInit): Promise<Response> =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

let sender: LiveScoreSender;

beforeEach(() => {
  sender = new LiveScoreSender(() => new Date(2026, 9, 14, 19, 5, 7));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LiveScoreSender - Aktivierung", () => {
  it("sends nothing while the switch is off", async () => {
    const store = loggedIn();
    const fetchMock = stubFetch();

    sender.observe(observation(playingState(), { enabled: false }));
    sender.observe(observation(throwTurn(playingState(), [[20], [20], [20]]), { enabled: false }));
    await sender.idle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(session(store)).toBeNull();
  });

  it("sends nothing without login", async () => {
    const store = stubLocalStorage();
    const fetchMock = stubFetch();

    sender.observe(observation(playingState(), { token: null }));
    await sender.idle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(session(store)).toBeNull();
  });

  it("stops sending once the switch is turned off mid-match", async () => {
    loggedIn();
    const fetchMock = stubFetch();
    const state = playingState();

    sender.observe(observation(state));
    await sender.idle();
    sender.observe(observation(throwTurn(state, [[20], [20], [20]]), { enabled: false }));
    await sender.idle();

    expect(methods(fetchMock)).toEqual(["POST"]);
  });
});

describe("LiveScoreSender - POST, PATCH, Lookup", () => {
  it("creates the record at match start and patches it afterwards", async () => {
    const store = loggedIn();
    const fetchMock = stubFetch();
    const start = playingState();

    sender.observe(observation(start));
    await sender.idle();
    sender.observe(observation(throwTurn(start, [[20, 3], [20], [6]])));
    await sender.idle();

    const [post, patch] = livescoreCalls(fetchMock);
    expect(post[0]).toBe(RECORDS_URL);
    expect(post[1].method).toBe("POST");
    expect((post[1].headers as Record<string, string>).Authorization).toBe("old-token");
    expect(bodyOf(post)).toMatchObject({ scoreHome: 501, scoreGuest: 501, status: "live", boardName: "Board 2" });
    expect(patch[0]).toBe(`${RECORDS_URL}/rec-1`);
    expect(patch[1].method).toBe("PATCH");
    expect(bodyOf(patch)).toMatchObject({ scoreHome: 415, averageHome: 86, activePlayer: "guest" });
    expect(bodyOf(patch).matchId).toBe(bodyOf(post).matchId);
    expect(session(store)).toEqual({ matchId: bodyOf(post).matchId, recordId: "rec-1" });
    expect(describeLiveSendStatus(sender.getStatus())).toBe("Zuletzt gesendet: 19:05:07");
  });

  it("does not resend an unchanged snapshot", async () => {
    loggedIn();
    const fetchMock = stubFetch();
    const state = playingState();

    sender.observe(observation(state));
    sender.observe(observation({ ...state }));
    await sender.idle();
    sender.observe(observation({ ...state }));
    await sender.idle();

    expect(methods(fetchMock)).toEqual(["POST"]);
  });

  it("continues with PATCH after a reload with a stored record id", async () => {
    loggedIn({ [SESSION_KEY]: JSON.stringify({ matchId: "live-1", recordId: "rec-9" }) });
    const fetchMock = stubFetch();

    sender.observe(observation(playingState()));
    await sender.idle();

    const [patch] = livescoreCalls(fetchMock);
    expect(methods(fetchMock)).toEqual(["PATCH"]);
    expect(patch[0]).toBe(`${RECORDS_URL}/rec-9`);
    expect(bodyOf(patch).matchId).toBe("live-1");
  });

  it("looks up the record id after a unique violation and patches it", async () => {
    const store = loggedIn({ [SESSION_KEY]: JSON.stringify({ matchId: "live-1" }) });
    const fetchMock = stubFetch((url, init) => {
      if (init.method === "POST") return unique();
      if (init.method === "PATCH") return json({ id: "rec-7" });
      return json({ items: [{ id: "rec-7" }] });
    });

    sender.observe(observation(playingState()));
    await sender.idle();

    expect(methods(fetchMock)).toEqual(["POST", "GET", "PATCH"]);
    const [, lookup, patch] = livescoreCalls(fetchMock);
    expect(decodeURIComponent(lookup[0])).toContain('filter=matchId="live-1"');
    expect(patch[0]).toBe(`${RECORDS_URL}/rec-7`);
    expect(session(store)).toEqual({ matchId: "live-1", recordId: "rec-7" });
  });
});

describe("LiveScoreSender - Coalescing und Fehler", () => {
  it("sends only the newest snapshot after an open request", async () => {
    loggedIn();
    let release: () => void = () => {};
    const fetchMock = stubFetch((url, init) => {
      if (init.method === "POST") {
        return new Promise((resolve) => {
          release = () => resolve(json({ id: "rec-1" }));
        });
      }
      return livescoreOk(url, init);
    });
    let state = playingState();

    sender.observe(observation(state));
    state = throwTurn(state, [[20], [20], [20]]);
    sender.observe(observation(state));
    state = throwTurn(state, [[19], [19], [19]]);
    sender.observe(observation(state));
    state = throwTurn(state, [[18], [18], [18]]);
    sender.observe(observation(state));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release();
    await sender.idle();

    expect(methods(fetchMock)).toEqual(["POST", "PATCH"]);
    expect(bodyOf(livescoreCalls(fetchMock)[1])).toMatchObject({ scoreHome: 387, scoreGuest: 444 });
  });

  it("gives up after a 5 second timeout and still sends the next snapshot", async () => {
    vi.useFakeTimers();
    const store = loggedIn();
    let first = true;
    const fetchMock = stubFetch((url, init) => {
      if (first) {
        first = false;
        return abortable(url, init);
      }
      return livescoreOk(url, init);
    });
    const state = playingState();
    const frozen = structuredClone(state);

    expect(() => sender.observe(observation(state))).not.toThrow();
    await vi.advanceTimersByTimeAsync(4999);
    expect(sender.getStatus().kind).toBe("idle");
    await vi.advanceTimersByTimeAsync(1);
    await sender.idle();

    expect(describeLiveSendStatus(sender.getStatus())).toBe("Fehler: Zeitüberschreitung");
    expect(state).toEqual(frozen);
    expect(store.has(MATCH_UPLOADED_KEY)).toBe(false);
    expect(store.has(MATCH_UPLOADED_API_KEY)).toBe(false);

    sender.observe(observation(throwTurn(state, [[20], [20], [20]])));
    await sender.idle();
    expect(methods(fetchMock)).toEqual(["POST", "POST"]);
    expect(sender.getStatus().kind).toBe("sent");
  });

  it("swallows network errors and retries with the next snapshot", async () => {
    const store = loggedIn();
    let fail = true;
    const fetchMock = stubFetch((url, init) => {
      if (fail) {
        fail = false;
        throw new TypeError("Failed to fetch");
      }
      return livescoreOk(url, init);
    });
    const state = playingState();
    const frozen = structuredClone(state);

    expect(() => sender.observe(observation(state))).not.toThrow();
    await sender.idle();
    expect(describeLiveSendStatus(sender.getStatus())).toBe("Fehler: keine Verbindung zur API");
    expect(state).toEqual(frozen);
    expect(store.has(MATCH_UPLOADED_KEY)).toBe(false);
    expect(store.has(MATCH_UPLOADED_API_KEY)).toBe(false);

    sender.observe(observation(throwTurn(state, [[20], [20], [20]])));
    await sender.idle();
    expect(methods(fetchMock)).toEqual(["POST", "POST"]);
    expect(session(store)?.recordId).toBe("rec-1");
  });
});

describe("LiveScoreSender - Anmeldung", () => {
  it("refreshes once on 401 and repeats the request once", async () => {
    const store = loggedIn();
    const fetchMock = stubFetch((url, init) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      if (!url.includes("/auth-refresh") && auth === "old-token") return json({ message: "expired" }, 401);
      return livescoreOk(url, init);
    });

    sender.observe(observation(playingState()));
    await sender.idle();

    const urls = calls(fetchMock).map(([url, init]) => `${init.method ?? "GET"} ${url.replace(POCKETBASE_URL, "")}`);
    expect(urls).toEqual([
      "POST /api/collections/livescore/records",
      "POST /api/collections/users/auth-refresh",
      "POST /api/collections/livescore/records",
    ]);
    expect(store.get(API_TOKEN_KEY)).toBe("new-token");
    expect(sender.getStatus().kind).toBe("sent");
  });

  it("pauses after a failed retry until the next login", async () => {
    loggedIn();
    const fetchMock = stubFetch((url, _init) => {
      if (url.includes("/auth-refresh")) return json({ token: "new-token" });
      return json({ message: "forbidden" }, 403);
    });
    let state = playingState();

    sender.observe(observation(state));
    await sender.idle();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(describeLiveSendStatus(sender.getStatus())).toBe("Anmeldung abgelaufen");

    state = throwTurn(state, [[20], [20], [20]]);
    sender.observe(observation(state));
    await sender.idle();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Neuer Login -> neues Token im App-Zustand.
    sender.observe(observation(state, { token: "fresh-token" }));
    await sender.idle();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("pauses when the refresh itself is rejected", async () => {
    loggedIn();
    const fetchMock = stubFetch(() => json({ message: "unauthorized" }, 401));

    sender.observe(observation(playingState()));
    await sender.idle();
    sender.observe(observation(throwTurn(playingState(), [[20], [20], [20]])));
    await sender.idle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sender.getStatus().kind).toBe("auth-expired");
  });
});

describe("LiveScoreSender - Status und Abschluss", () => {
  it("finishes only after 'Weiter'; 'Rückgängig' returns to live", async () => {
    const store = loggedIn();
    const fetchMock = stubFetch();
    const running = beforeCheckout(1);
    const finished = checkout(running);

    sender.observe(observation(running));
    await sender.idle();
    sender.observe(observation(finished));
    await sender.idle();
    const undone = reduce(finished, { type: "UNDO_LEG_RESULT" });
    sender.observe(observation(undone));
    await sender.idle();
    sender.observe(observation(finished));
    await sender.idle();
    expect(session(store)).not.toBeNull();
    sender.observe(observation(finished, { matchConfirmed: true }));
    await sender.idle();

    const statuses = livescoreCalls(fetchMock).map((call) => [bodyOf(call).status, bodyOf(call).legsHome]);
    expect(statuses).toEqual([
      ["live", 0],
      ["live", 1],
      ["live", 0],
      ["live", 1],
      ["finished", 1],
    ]);
    // Nach dem Abschluss verfallen liveMatchId und Record-id.
    expect(session(store)).toBeNull();

    // Ein späterer Render (z.B. nach Reload der Statistik) sendet nichts mehr.
    sender.observe(observation({ ...finished }, { matchConfirmed: true }));
    await sender.idle();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("sends finished when the match is aborted", async () => {
    const store = loggedIn();
    const fetchMock = stubFetch();
    const state = throwTurn(playingState(), [[20], [20], [20]]);

    sender.observe(observation(state));
    await sender.idle();
    sender.observe(observation(reduce(state, { type: "ABORT_MATCH" })));
    await sender.idle();

    const [post, patch] = livescoreCalls(fetchMock);
    expect(bodyOf(post).status).toBe("live");
    expect(bodyOf(patch)).toMatchObject({ status: "finished", scoreHome: 441 });
    expect(session(store)).toBeNull();
  });

  it("sends finished on abort even while the first POST is still open", async () => {
    loggedIn();
    let release: () => void = () => {};
    const fetchMock = stubFetch((url, init) => {
      if (init.method === "POST") {
        return new Promise((resolve) => {
          release = () => resolve(json({ id: "rec-1" }));
        });
      }
      return livescoreOk(url, init);
    });
    const state = playingState();

    sender.observe(observation(state));
    sender.observe(observation(reduce(state, { type: "ABORT_MATCH" })));
    release();
    await sender.idle();

    expect(methods(fetchMock)).toEqual(["POST", "PATCH"]);
    expect(bodyOf(livescoreCalls(fetchMock)[1]).status).toBe("finished");
  });

  it("clears the keys on a new match and starts with a fresh liveMatchId", async () => {
    const store = loggedIn({ [SESSION_KEY]: JSON.stringify({ matchId: "old", recordId: "rec-old" }) });
    const fetchMock = stubFetch();
    const setup = createInitialState("Alice", "Bob", 2);

    sender.observe(observation(setup));
    expect(session(store)).toBeNull();
    sender.observe(observation({ ...setup, phase: "playing" }));
    await sender.idle();

    expect(methods(fetchMock)).toEqual(["POST"]);
    expect(bodyOf(livescoreCalls(fetchMock)[0]).matchId).not.toBe("old");
  });

  it("never creates a liveMatchId for an already confirmed match", async () => {
    const store = loggedIn();
    const fetchMock = stubFetch();

    sender.observe(observation(checkout(beforeCheckout(1)), { matchConfirmed: true }));
    await sender.idle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(session(store)).toBeNull();
  });
});
