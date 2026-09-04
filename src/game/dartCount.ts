import type { Turn } from "./types";

export const dartsInTurns = (turns: Turn[]): number =>
  turns.reduce((sum, turn) => sum + turn.darts.length, 0);
