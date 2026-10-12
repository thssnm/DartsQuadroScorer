import type { GameState } from "../game/types";
import type { GistConfig } from "../gist/config";
import { isNewMatchLocked, runUploadFlow, IDLE_UPLOAD_STATE, type UploadFlowState } from "../gist/uploadFlow";
import { runApiUploadFlow } from "./matchUpload";

// Zwei unabhängige Upload-Ziele mit gleichem Ablauf: eigener Status, eigener
// Merker, eigener Retry.
export type UploadTarget = "gist" | "api";

export const UPLOAD_TARGETS: UploadTarget[] = ["gist", "api"];

export type UploadTargetsState = Record<UploadTarget, UploadFlowState>;

export const IDLE_TARGETS_STATE: UploadTargetsState = { gist: IDLE_UPLOAD_STATE, api: IDLE_UPLOAD_STATE };

export const PENDING_TARGETS_STATE: UploadTargetsState = {
  gist: { phase: "pending", failure: null },
  api: { phase: "pending", failure: null },
};

// "Neues Match" bleibt zu, bis jedes Ziel fertig ist. Ein übersprungenes
// Ziel meldet "done" und zählt damit als fertig.
export const isNewMatchLockedForTargets = (state: UploadTargetsState): boolean =>
  UPLOAD_TARGETS.some((target) => isNewMatchLocked(state[target]));

const hasFailure = (state: UploadFlowState): boolean =>
  state.phase === "failed" || (state.phase === "pending" && state.failure !== null);

export const failedTargets = (state: UploadTargetsState): UploadTarget[] =>
  UPLOAD_TARGETS.filter((target) => hasFailure(state[target]));

// Das Popup erscheint erst, wenn kein Ziel mehr im ersten Versuch steckt -
// sonst könnte "Der Gist-Upload war erfolgreich" auftauchen, bevor der Gist
// überhaupt geantwortet hat.
export const isUploadPopupVisible = (state: UploadTargetsState): boolean =>
  !UPLOAD_TARGETS.some((target) => state[target].phase === "pending" && state[target].failure === null) &&
  failedTargets(state).length > 0;

export const isUploadRetrying = (state: UploadTargetsState): boolean =>
  UPLOAD_TARGETS.some((target) => state[target].phase === "pending");

// Beim Wiederholen bleibt der bekannte Fehler stehen, damit das Popup
// während des neuen Versuchs nicht kurz verschwindet.
export const applyTargetState = (
  previous: UploadTargetsState,
  target: UploadTarget,
  next: UploadFlowState
): UploadTargetsState => ({
  ...previous,
  [target]: next.phase === "pending" ? { phase: "pending", failure: previous[target].failure } : next,
});

export const acknowledgeUploadFailures = (state: UploadTargetsState): UploadTargetsState => ({
  gist: hasFailure(state.gist) ? { phase: "acknowledged", failure: null } : state.gist,
  api: hasFailure(state.api) ? { phase: "acknowledged", failure: null } : state.api,
});

export interface MatchUploadTargetsOptions {
  enabled: boolean;
  gistConfig: GistConfig;
  boardId: string;
  state: GameState;
  historyEntryId: string | null;
}

// Startet die gewünschten Ziele gleichzeitig. Ein Ziel, das wirft, hält das
// andere nicht auf.
export const runMatchUploadTargets = async (
  targets: UploadTarget[],
  options: MatchUploadTargetsOptions,
  onState: (target: UploadTarget, state: UploadFlowState) => void
): Promise<void> => {
  const runners: Record<UploadTarget, () => Promise<UploadFlowState>> = {
    gist: () =>
      runUploadFlow(
        { enabled: options.enabled, config: options.gistConfig, boardId: options.boardId, state: options.state },
        (next) => onState("gist", next)
      ),
    api: () =>
      runApiUploadFlow(
        {
          enabled: options.enabled,
          boardId: options.boardId,
          state: options.state,
          historyEntryId: options.historyEntryId,
        },
        (next) => onState("api", next)
      ),
  };
  await Promise.allSettled(targets.map((target) => runners[target]()));
};
