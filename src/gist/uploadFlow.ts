import type { GameState } from "../game/types";
import type { GistConfig } from "./config";
import { uploadMatchResultOnce, type UploadFailure } from "./matchUpload";

// idle: kein Upload für dieses Match offen. pending: Versuch läuft, das
// Promise ist noch nicht aufgelöst. done: erfolgreich (oder nichts
// hochzuladen). failed: Fehler, Popup offen. acknowledged: Fehler quittiert.
export type UploadPhase = "idle" | "pending" | "done" | "failed" | "acknowledged";

export interface UploadFlowState {
  phase: UploadPhase;
  failure: UploadFailure | null;
}

export const IDLE_UPLOAD_STATE: UploadFlowState = { phase: "idle", failure: null };

// "Neues Match" wird NUR freigegeben, wenn ein Upload-Versuch abgeschlossen
// ist: erfolgreich (done) oder mit quittiertem Fehler (acknowledged).
// Bewusst als Positivliste: "idle" heißt, der Versuch ist noch nicht einmal
// gestartet - zwischen dem ersten Rendern der Statistik-Seite und dem Start
// des Uploads darf der Button nicht aufgehen. Maßgeblich ist allein der
// Zustand des Promise, keine geschätzte Dauer und kein Timer; beim Turnier
// dauerte ein Upload 1-2 Sekunden.
export const isNewMatchLocked = (state: UploadFlowState): boolean =>
  state.phase !== "done" && state.phase !== "acknowledged";

interface UploadFlowOptions {
  enabled: boolean;
  config: GistConfig;
  boardId: string;
  state: GameState;
}

// Führt einen Upload-Versuch aus und meldet jeden Zustandswechsel. "pending"
// wird synchron gemeldet, bevor der Request überhaupt startet - zwischen dem
// Klick auf "Weiter zur Statistik" und der Sperre liegt damit kein Moment,
// in dem der Button offen wäre.
export const runUploadFlow = async (
  options: UploadFlowOptions,
  onState: (state: UploadFlowState) => void
): Promise<UploadFlowState> => {
  onState({ phase: "pending", failure: null });

  const outcome = await uploadMatchResultOnce(options);
  const next: UploadFlowState =
    outcome.result === "failed"
      ? { phase: "failed", failure: outcome.failure ?? null }
      : { phase: "done", failure: null };

  onState(next);
  return next;
};
