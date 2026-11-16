// Zustand des Ergebnis-Uploads für das bestätigte Match, so wie App.tsx ihn
// hält. Ohne React, damit die Sperre von "Neues Match" testbar bleibt.

export type MatchUploadStatus = "skipped" | "uploaded" | "failed" | "already-uploaded";

// Unterscheidet die Fehlerquellen, damit nach einem Turnier nachvollziehbar
// ist, ob es am WLAN lag oder an der Anmeldung: network = fetch kam gar
// nicht durch, http = die API hat abgelehnt, config = nicht angemeldet,
// unknown = alles andere.
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

// idle: kein Upload für dieses Match offen. pending: Versuch läuft, das
// Promise ist noch nicht aufgelöst. done: erfolgreich (oder nichts
// hochzuladen). failed: Fehler, Popup offen. acknowledged: Fehler quittiert.
export type UploadPhase = "idle" | "pending" | "done" | "failed" | "acknowledged";

export interface UploadFlowState {
  phase: UploadPhase;
  failure: UploadFailure | null;
}

export const IDLE_UPLOAD_STATE: UploadFlowState = { phase: "idle", failure: null };
export const PENDING_UPLOAD_STATE: UploadFlowState = { phase: "pending", failure: null };

// "Neues Match" wird NUR freigegeben, wenn ein Upload-Versuch abgeschlossen
// ist: erfolgreich (done) oder mit quittiertem Fehler (acknowledged).
// Bewusst als Positivliste: "idle" heißt, der Versuch ist noch nicht einmal
// gestartet - zwischen dem ersten Rendern der Statistik-Seite und dem Start
// des Uploads darf der Button nicht aufgehen. Maßgeblich ist allein der
// Zustand des Promise, keine geschätzte Dauer und kein Timer; beim Turnier
// dauerte ein Upload 1-2 Sekunden.
export const isNewMatchLocked = (state: UploadFlowState): boolean =>
  state.phase !== "done" && state.phase !== "acknowledged";

// Während eines Wiederholungsversuchs bleibt der bekannte Fehler stehen,
// damit das Popup nicht kurz verschwindet.
export const isUploadPopupVisible = (state: UploadFlowState): boolean =>
  state.phase === "failed" || (state.phase === "pending" && state.failure !== null);

export const isUploadRetrying = (state: UploadFlowState): boolean => state.phase === "pending";

export const applyUploadState = (previous: UploadFlowState, next: UploadFlowState): UploadFlowState =>
  next.phase === "pending" ? { phase: "pending", failure: previous.failure } : next;

export const acknowledgeUploadFailure = (state: UploadFlowState): UploadFlowState =>
  isUploadPopupVisible(state) ? { phase: "acknowledged", failure: null } : state;
