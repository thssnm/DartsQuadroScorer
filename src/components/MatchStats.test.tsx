import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatchStats } from "./MatchStats";
import { createInitialState } from "../game/gameReducer";
import type { GameState } from "../game/types";
import {
  IDLE_UPLOAD_STATE,
  isNewMatchLocked,
  runUploadFlow,
  type UploadFlowState,
} from "../gist/uploadFlow";

// Beim Turnier dauerte ein Upload 1-2 Sekunden. Genau dieses Fenster wird
// hier nachgestellt - ein sofort auflösendes Mock würde die Race Condition
// gar nicht erst sichtbar machen.
const UPLOAD_DELAY_MS = 1500;

const finishedMatch = (): GameState => {
  const initial = createInitialState("Alice", "Bob", 1);
  return {
    ...initial,
    phase: "match-finished",
    players: [{ ...initial.players[0], legsWon: 1, remaining: 0 }, initial.players[1]],
  };
};

const stubLocalStorage = () => {
  const store = new Map<string, string>();
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

// fetch, das erst nach UPLOAD_DELAY_MS antwortet - wie eine träge WLAN-
// Verbindung am Board.
const delayedFetch = (ok: boolean) =>
  vi.fn(
    () =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (ok) {
            resolve({ ok: true, json: async () => ({ files: {} }) } as unknown as Response);
          } else {
            reject(new TypeError("Failed to fetch"));
          }
        }, UPLOAD_DELAY_MS);
      })
  );

const uploadOptions = () => ({
  enabled: true,
  config: { token: "token", gistId: "gist-id" },
  boardId: "Board 1",
  state: finishedMatch(),
});

// Der Button, so wie er im Render-Baum landet.
interface ButtonElement {
  props: { disabled?: boolean; onClick?: () => void; children?: unknown };
}

const findNewMatchButton = (node: unknown): ButtonElement | null => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findNewMatchButton(child);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object" || !("props" in node)) return null;
  const element = node as { type?: unknown; props: { children?: unknown } };
  if (element.type === "button" && collectText(element.props.children).includes("Neues Match")) {
    return element as ButtonElement;
  }
  return findNewMatchButton(element.props.children);
};

const collectText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).join("");
  if (value && typeof value === "object" && "props" in value) {
    return collectText((value as { props: { children?: unknown } }).props.children);
  }
  return "";
};

const renderStats = (uploadState: UploadFlowState, onNewMatch = vi.fn()) => {
  const props = {
    state: finishedMatch(),
    onNewMatch,
    newMatchDisabled: isNewMatchLocked(uploadState),
  };
  return {
    markup: renderToStaticMarkup(<MatchStats {...props} />),
    button: findNewMatchButton(MatchStats(props)),
    onNewMatch,
  };
};

describe("new match lock during a slow upload", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the button disabled before the upload has even started", () => {
    // Zwischen dem ersten Rendern der Statistik-Seite und dem Start des
    // Uploads liegt ein Render-Durchlauf - auch der muss gesperrt sein.
    expect(isNewMatchLocked(IDLE_UPLOAD_STATE)).toBe(true);
    expect(renderStats(IDLE_UPLOAD_STATE).markup).toContain("disabled");
  });

  it("keeps the button disabled for the whole time the upload promise is open", async () => {
    stubLocalStorage();
    vi.stubGlobal("fetch", delayedFetch(true));

    let uploadState: UploadFlowState = IDLE_UPLOAD_STATE;
    expect(isNewMatchLocked(uploadState)).toBe(true);
    const pending = runUploadFlow(uploadOptions(), (next) => {
      uploadState = next;
    });

    // Direkt nach dem Start, noch bevor irgendein Request antwortet.
    expect(uploadState.phase).toBe("pending");
    expect(isNewMatchLocked(uploadState)).toBe(true);
    expect(renderStats(uploadState).markup).toContain("disabled");

    // Mitten im Zeitfenster, in dem am Board geklickt wurde.
    await vi.advanceTimersByTimeAsync(UPLOAD_DELAY_MS);
    expect(uploadState.phase).toBe("pending");
    expect(renderStats(uploadState).markup).toContain("disabled");

    // Der Upload liest den Gist und schreibt ihn - zwei verzögerte Requests.
    await vi.advanceTimersByTimeAsync(UPLOAD_DELAY_MS);
    await pending;

    expect(uploadState.phase).toBe("done");
    expect(isNewMatchLocked(uploadState)).toBe(false);
    expect(renderStats(uploadState).markup).not.toContain("disabled");
  });

  it("ignores a click on the button while the upload promise is still open", async () => {
    stubLocalStorage();
    vi.stubGlobal("fetch", delayedFetch(true));

    let uploadState: UploadFlowState = IDLE_UPLOAD_STATE;
    const pending = runUploadFlow(uploadOptions(), (next) => {
      uploadState = next;
    });

    const whilePending = renderStats(uploadState);
    expect(whilePending.button?.props.disabled).toBe(true);
    // Doppelte Absicherung: auch ein durchkommender Klick tut nichts.
    whilePending.button?.props.onClick?.();
    expect(whilePending.onNewMatch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(UPLOAD_DELAY_MS * 2);
    await pending;

    const afterUpload = renderStats(uploadState);
    expect(afterUpload.button?.props.disabled).toBe(false);
    afterUpload.button?.props.onClick?.();
    expect(afterUpload.onNewMatch).toHaveBeenCalledTimes(1);
  });

  it("stays locked after a slow upload fails, until the error is acknowledged", async () => {
    stubLocalStorage();
    vi.stubGlobal("fetch", delayedFetch(false));

    let uploadState: UploadFlowState = IDLE_UPLOAD_STATE;
    const pending = runUploadFlow(uploadOptions(), (next) => {
      uploadState = next;
    });

    expect(isNewMatchLocked(uploadState)).toBe(true);

    await vi.advanceTimersByTimeAsync(UPLOAD_DELAY_MS);
    await pending;

    expect(uploadState.phase).toBe("failed");
    expect(uploadState.failure?.kind).toBe("network");
    expect(isNewMatchLocked(uploadState)).toBe(true);
    expect(renderStats(uploadState).markup).toContain("disabled");

    // "Verstanden" im Popup quittiert den Fehler.
    const acknowledged: UploadFlowState = { phase: "acknowledged", failure: null };
    expect(isNewMatchLocked(acknowledged)).toBe(false);
    expect(renderStats(acknowledged).markup).not.toContain("disabled");
  });
});
