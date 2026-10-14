import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../game/gameReducer";
import { loadMatchHistory, saveCurrentMatchHistoryId } from "../game/persistence";
import type { GameState } from "../game/types";
import { recordFinishedMatch } from "../gist/matchHistory";
import { ensureApiHistoryFields, uploadApiMatchResultOnce } from "../api/matchUpload";
import { apiRoutes, bodyOf, callsTo, gistOk, loggedIn, stubFetch } from "../api/testHelpers";

const SESSION_KEY = "darts-quadro-scorer:livescore-session";

const finishedState = (): GameState => {
  const initial = createInitialState("Alice", "Bob", 1);
  return {
    ...initial,
    phase: "match-finished",
    players: [{ ...initial.players[0], legsWon: 1 }, initial.players[1]],
  };
};

const withLiveSession = () => ({ [SESSION_KEY]: JSON.stringify({ matchId: "live-123", recordId: "rec-1" }) });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("matchId des Ergebnis-Uploads", () => {
  it("takes the liveMatchId of the running match", async () => {
    loggedIn(withLiveSession());
    const fetchMock = stubFetch(gistOk, apiRoutes());

    const id = recordFinishedMatch(finishedState(), "Board 2", true);
    expect(ensureApiHistoryFields(id)).toBe("live-123");
    await uploadApiMatchResultOnce({ enabled: true, boardId: "Board 2", state: finishedState(), historyEntryId: id });

    expect(loadMatchHistory()[0].matchId).toBe("live-123");
    expect(bodyOf(callsTo(fetchMock, "/results/records")[0]).matchId).toBe("live-123");
  });

  it("creates its own matchId as before without a live session", () => {
    loggedIn();

    const id = recordFinishedMatch(finishedState(), "Board 2", true);
    const matchId = ensureApiHistoryFields(id);

    expect(matchId).toMatch(/^[0-9a-f-]{36}$/);
    expect(matchId).not.toBe("live-123");
  });

  it("keeps an already stored matchId", () => {
    loggedIn();
    const id = recordFinishedMatch(finishedState(), "Board 2", true);
    const first = ensureApiHistoryFields(id);

    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ matchId: "live-123" }));
    expect(ensureApiHistoryFields(id)).toBe(first);
  });

  it("never hands the liveMatchId to an older history entry", () => {
    loggedIn();
    const oldId = recordFinishedMatch(finishedState(), "Board 2", true);
    saveCurrentMatchHistoryId(null);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ matchId: "live-123" }));

    expect(ensureApiHistoryFields(oldId)).not.toBe("live-123");
  });

  it("uses the liveMatchId when uploading without a history entry", async () => {
    loggedIn(withLiveSession());
    const fetchMock = stubFetch(gistOk, apiRoutes());

    await uploadApiMatchResultOnce({ enabled: true, boardId: "Board 2", state: finishedState(), historyEntryId: null });

    expect(bodyOf(callsTo(fetchMock, "/results/records")[0]).matchId).toBe("live-123");
  });
});
