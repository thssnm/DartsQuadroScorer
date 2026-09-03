import type { GameState } from "../game/types";
import type { GistConfig } from "./config";

export interface BoardGistFile {
  boardName: string;
  home: string;
  guest: string;
  legsHome: number;
  legsGuest: number;
  status: "finished";
  highlights: unknown[];
  updatedAt: string;
  acknowledged: false;
}

export interface PlayersGistFile {
  players: string[];
}

interface GistResponse {
  files?: Record<string, { content?: string } | null>;
}

const GIST_API_URL = "https://api.github.com/gists";
const PLAYERS_FILE = "players.json";

const fallbackMatchFileId = (): string => {
  const timestamp = new Date().toISOString().replace(/[^0-9A-Z]/gi, "");
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
};

export const createMatchFileId = (): string => globalThis.crypto?.randomUUID?.() ?? fallbackMatchFileId();

const fileNamePart = (value: string): string => value.trim().replace(/[^a-z0-9_-]+/gi, "-") || "board";

export const boardFileName = (boardId: string, matchFileId: string): string =>
  `board-${fileNamePart(boardId)}-${matchFileId}.json`;

export const defaultBoardName = (boardId: string): string => boardId.trim() || "Board 1";

export const mapGameStateToBoardFile = (
  state: GameState,
  boardName: string,
  updatedAt: string = new Date().toISOString()
): BoardGistFile => ({
  boardName,
  home: state.players[0].name,
  guest: state.players[1].name,
  legsHome: state.players[0].legsWon,
  legsGuest: state.players[1].legsWon,
  status: "finished",
  highlights: [],
  updatedAt,
  acknowledged: false,
});

const authHeaders = (config: GistConfig): Record<string, string> => ({
  Authorization: `Bearer ${config.token.trim()}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

const assertOk = async (response: Response): Promise<void> => {
  if (response.ok) return;
  let message = `GitHub Gist request failed (${response.status})`;
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // GitHub liefert normalerweise JSON; der Status reicht als Fallback.
  }
  throw new Error(message);
};

const readPlayers = async (config: GistConfig): Promise<PlayersGistFile> => {
  const response = await fetch(`${GIST_API_URL}/${encodeURIComponent(config.gistId.trim())}`, {
    headers: authHeaders(config),
  });
  await assertOk(response);

  const gist = (await response.json()) as GistResponse;
  const content = gist.files?.[PLAYERS_FILE]?.content;
  if (!content) return { players: [] };

  const parsed = JSON.parse(content) as Partial<PlayersGistFile>;
  return { players: Array.isArray(parsed.players) ? parsed.players.filter(isPlayerName) : [] };
};

const isPlayerName = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const mergePlayers = (existing: string[], additions: string[]): string[] => {
  const players = existing.filter(isPlayerName).map((name) => name.trim());
  for (const name of additions.map((entry) => entry.trim()).filter(Boolean)) {
    if (!players.includes(name)) players.push(name);
  }
  return players;
};

export const uploadFinishedMatchToGist = async (
  config: GistConfig,
  boardId: string,
  board: BoardGistFile
): Promise<void> => {
  const players = await readPlayers(config);
  const mergedPlayers: PlayersGistFile = {
    players: mergePlayers(players.players, [board.home, board.guest]),
  };

  const response = await fetch(`${GIST_API_URL}/${encodeURIComponent(config.gistId.trim())}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(config),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        [boardFileName(boardId, createMatchFileId())]: { content: JSON.stringify(board, null, 2) },
        [PLAYERS_FILE]: { content: JSON.stringify(mergedPlayers, null, 2) },
      },
    }),
  });
  await assertOk(response);
};
