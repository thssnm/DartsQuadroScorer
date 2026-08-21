import type { CompletedLeg, PlayerState, Turn } from "./types";
import { turnTotal } from "./types";

export interface BestLeg {
  darts: number; // Anzahl geworfener Darts im Leg
}

export interface PlayerStats {
  count240: number; // Vierfach-Möglichkeit: max Wurf 60 pro Dart bei x4-20, also 3 Darts = 240
  count180Plus: number;
  count140Plus: number;
  matchAverage: number; // Punkte pro 3 Darts über alle abgeschlossenen + laufenden Legs
  legAverage: number; // Punkte pro 3 Darts im aktuellen (laufenden) Leg
  bestLeg: BestLeg | null; // wenigste Darts für ein gewonnenes Leg
}

const dartsInTurns = (turns: Turn[]) => turns.reduce((sum, t) => sum + t.darts.length, 0);
const scoreInTurns = (turns: Turn[]) =>
  turns.reduce((sum, t) => sum + (t.bust ? 0 : turnTotal(t.darts)), 0);

// Average nach Standard-Darts-Konvention: Gesamtpunkte / tatsächlich
// geworfene Darts * 3. Wichtig bei Finish-Aufnahmen mit weniger als 3
// Darts (z.B. 1 Dart für 40 Punkte) - würde man das als volle Aufnahme
// zählen, würde ein kurzes Finish den Schnitt künstlich nach oben ziehen.
const average = (turns: Turn[]): number => {
  const darts = dartsInTurns(turns);
  return darts > 0 ? (scoreInTurns(turns) / darts) * 3 : 0;
};

const bestLegFromHistory = (legHistory: CompletedLeg[]): BestLeg | null => {
  const wonLegs = legHistory.filter((l) => l.won);
  if (wonLegs.length === 0) return null;
  let best: BestLeg | null = null;
  for (const leg of wonLegs) {
    const darts = dartsInTurns(leg.turns);
    if (best === null || darts < best.darts) best = { darts };
  }
  return best;
};

export const computePlayerStats = (player: PlayerState): PlayerStats => {
  const allTurns = [...player.legHistory.flatMap((l) => l.turns), ...player.turns];

  let count240 = 0;
  let count180Plus = 0;
  let count140Plus = 0;

  for (const turn of allTurns) {
    if (turn.bust) continue;
    const total = turnTotal(turn.darts);
    if (total === 240) count240++;
    if (total >= 180) count180Plus++;
    if (total >= 140) count140Plus++;
  }

  return {
    count240,
    count180Plus,
    count140Plus,
    matchAverage: average(allTurns),
    legAverage: average(player.turns),
    bestLeg: bestLegFromHistory(player.legHistory),
  };
};
