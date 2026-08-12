import type { PlayerState } from "./types";
import { turnTotal } from "./types";

export interface PlayerStats {
  count100Plus: number;
  count140Plus: number;
  count180: number;
  matchAverage: number; // Punkte pro 3 Darts über gesamtes Match (alle Legs)
  legAverage: number; // Punkte pro 3 Darts im aktuellen Leg
  best: number | null; // höchste einzelne Aufnahme
}

export const computePlayerStats = (
  player: PlayerState,
  legsHistory: PlayerState["turns"][] = []
): PlayerStats => {
  const currentLegTurns = player.turns.filter((t) => !t.bust || true); // Busts zählen als Aufnahme mit 0 fürs Scoring-Displays separat behandelt
  const allTurns = [...legsHistory.flat(), ...player.turns];

  let count100Plus = 0;
  let count140Plus = 0;
  let count180 = 0;
  let best: number | null = null;

  for (const turn of allTurns) {
    const total = turnTotal(turn.darts);
    if (turn.bust) continue;
    if (total >= 100) count100Plus++;
    if (total >= 140) count140Plus++;
    if (total === 180) count180++;
    if (best === null || total > best) best = total;
  }

  const sumScored = (turns: typeof allTurns) =>
    turns.reduce((sum, t) => sum + (t.bust ? 0 : turnTotal(t.darts)), 0);
  const dartsThrown = (turns: typeof allTurns) =>
    turns.reduce((sum, t) => sum + t.darts.length, 0);

  const matchDarts = dartsThrown(allTurns);
  const matchAverage = matchDarts > 0 ? (sumScored(allTurns) / matchDarts) * 3 : 0;

  const legDarts = dartsThrown(currentLegTurns);
  const legAverage = legDarts > 0 ? (sumScored(currentLegTurns) / legDarts) * 3 : 0;

  return { count100Plus, count140Plus, count180, matchAverage, legAverage, best };
};
