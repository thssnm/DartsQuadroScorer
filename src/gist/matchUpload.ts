import type { GameState } from "../game/types";
import { loadMatchUploaded, saveMatchUploaded } from "../game/persistence";
import {
  GistHttpError,
  defaultBoardName,
  mapGameStateToBoardFile,
  uploadFinishedMatchToGist,
} from "./api";
import { isGistConfigComplete, type GistConfig } from "./config";

export type MatchUploadStatus = "skipped" | "uploaded" | "failed" | "already-uploaded";

// Unterscheidet die Fehlerquellen, damit nach einem Turnier nachvollziehbar
// ist, ob es am WLAN lag oder an der Gist-Anbindung:
// network = fetch kam gar nicht durch, http = GitHub hat abgelehnt,
// config = Gist-ID oder Token fehlt, unknown = alles andere.
export type UploadErrorKind = "network" | "http" | "config" | "unknown";

export interface UploadFailure {
  kind: UploadErrorKind;
  message: string;
  status?: number;
}

export interface MatchUploadOutcome {
  result: MatchUploadStatus;
  failure?: UploadFailure;
}

interface MatchUploadOptions {
  enabled: boolean;
  config: GistConfig;
  boardId: string;
  state: GameState;
}

export const classifyUploadError = (error: unknown): UploadFailure => {
  if (error instanceof GistHttpError) {
    return { kind: "http", status: error.status, message: error.message };
  }
  // fetch lehnt mit TypeError ab, wenn die Anfrage das Gerät nicht verlässt
  // oder die Antwort nie ankommt - der typische WLAN-Abbruch.
  if (error instanceof TypeError) {
    return { kind: "network", message: error.message };
  }
  return { kind: "unknown", message: error instanceof Error ? error.message : String(error) };
};

// Kurzer Klartext für das Fehler-Popup und die Konsole.
export const describeUploadFailure = (failure: UploadFailure): string => {
  switch (failure.kind) {
    case "network":
      return "Netzwerkfehler: keine Verbindung zu GitHub (WLAN prüfen).";
    case "config":
      return "Gist-ID oder Token fehlt in den Einstellungen.";
    case "http":
      switch (failure.status) {
        case 401:
          return "GitHub hat den Zugriff abgelehnt (401): Token ungültig oder abgelaufen.";
        case 403:
          return "GitHub hat den Zugriff verweigert (403): fehlende Rechte oder Limit erreicht.";
        case 404:
          return "Gist nicht gefunden (404): Gist-ID prüfen.";
        default:
          return `GitHub-Fehler (${failure.status ?? "?"}): ${failure.message}`;
      }
    default:
      return `Unbekannter Fehler: ${failure.message}`;
  }
};

export const uploadMatchResult = async ({
  enabled,
  config,
  boardId,
  state,
}: MatchUploadOptions): Promise<MatchUploadOutcome> => {
  if (!enabled) return { result: "skipped" };
  if (!isGistConfigComplete(config)) {
    return {
      result: "failed",
      failure: { kind: "config", message: "Gist-Konfiguration unvollständig" },
    };
  }

  const effectiveBoardId = defaultBoardName(boardId);
  const board = mapGameStateToBoardFile(state, effectiveBoardId);

  try {
    await uploadFinishedMatchToGist(config, effectiveBoardId, board);
    return { result: "uploaded" };
  } catch (error) {
    const failure = classifyUploadError(error);
    // Bleibt in der Browser-Konsole stehen, damit sich nach einem Turnier
    // nachsehen lässt, woran die fehlenden Uploads lagen.
    console.error("[darts] Gist-Upload fehlgeschlagen:", describeUploadFailure(failure), failure);
    return { result: "failed", failure };
  }
};

// Lädt das Ergebnis höchstens einmal pro Match hoch. Der Merker liegt im
// localStorage, greift also auch nach einem Reload, bei dem das
// Match-Ende-Popup erneut erscheint. Gesetzt wird er nur nach einem
// erfolgreichen Upload - ein fehlgeschlagener Versuch (Netzwerk, Token)
// bleibt wiederholbar.
export const uploadMatchResultOnce = async (
  options: MatchUploadOptions
): Promise<MatchUploadOutcome> => {
  if (loadMatchUploaded()) return { result: "already-uploaded" };

  const outcome = await uploadMatchResult(options);
  if (outcome.result === "uploaded") saveMatchUploaded(true);
  return outcome;
};
