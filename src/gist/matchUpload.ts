import type { GameState } from "../game/types";
import { loadMatchUploaded, saveMatchUploaded } from "../game/persistence";
import { defaultBoardName, mapGameStateToBoardFile, uploadFinishedMatchToGist } from "./api";
import { isGistConfigComplete, type GistConfig } from "./config";

export type MatchUploadResult = "skipped" | "uploaded" | "failed" | "already-uploaded";

interface MatchUploadOptions {
  enabled: boolean;
  config: GistConfig;
  boardId: string;
  state: GameState;
}

export const uploadMatchResult = async ({
  enabled,
  config,
  boardId,
  state,
}: MatchUploadOptions): Promise<MatchUploadResult> => {
  if (!enabled) return "skipped";
  if (!isGistConfigComplete(config)) return "failed";

  const effectiveBoardId = defaultBoardName(boardId);
  const board = mapGameStateToBoardFile(state, effectiveBoardId);

  try {
    await uploadFinishedMatchToGist(config, effectiveBoardId, board);
    return "uploaded";
  } catch {
    return "failed";
  }
};

// Lädt das Ergebnis höchstens einmal pro Match hoch. Der Merker liegt im
// localStorage, greift also auch nach einem Reload, bei dem das
// Match-Ende-Popup erneut erscheint. Gesetzt wird er nur nach einem
// erfolgreichen Upload - ein fehlgeschlagener Versuch (Netzwerk, Token)
// bleibt wiederholbar.
export const uploadMatchResultOnce = async (
  options: MatchUploadOptions
): Promise<MatchUploadResult> => {
  if (loadMatchUploaded()) return "already-uploaded";

  const result = await uploadMatchResult(options);
  if (result === "uploaded") saveMatchUploaded(true);
  return result;
};
