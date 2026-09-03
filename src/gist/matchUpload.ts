import type { GameState } from "../game/types";
import { defaultBoardName, mapGameStateToBoardFile, uploadFinishedMatchToGist } from "./api";
import { isGistConfigComplete, type GistConfig } from "./config";

export type MatchUploadResult = "skipped" | "uploaded" | "failed";

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
