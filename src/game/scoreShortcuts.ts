import type { GameState } from "./types";
import type { ScoreCounts } from "./persistence";

// Startbelegung der Shortcuts, solange noch keine Matches gezählt sind.
export const DEFAULT_SCORE_SHORTCUTS = [140, 100, 80, 60, 41, 45];
export const SHORTCUT_COUNT = DEFAULT_SCORE_SHORTCUTS.length;

// Zählt alle Nicht-Bust-Aufnahmen beider Spieler eines beendeten Matches
// zu den bisherigen Zählern dazu. Wird erst beim Abschluss des Matches
// aufgerufen - Rückgängig und Korrekturen sind dann durch.
export const addMatchScores = (counts: ScoreCounts, state: GameState): ScoreCounts => {
  const next = { ...counts };
  for (const player of state.players) {
    for (const turn of [...player.legHistory.flatMap((leg) => leg.turns), ...player.turns]) {
      if (turn.bust) continue;
      const key = String(turn.score);
      next[key] = (next[key] ?? 0) + 1;
    }
  }
  return next;
};

// Die häufigsten Scores, absteigend nach Häufigkeit, bei Gleichstand der
// höhere Score zuerst. Fehlende Plätze füllen die Defaults in ihrer
// Reihenfolge auf.
export const scoreShortcuts = (counts: ScoreCounts): number[] => {
  const ranked = Object.entries(counts)
    .map(([score, count]) => ({ score: Number(score), count }))
    .filter(({ score, count }) => Number.isInteger(score) && count > 0)
    .sort((a, b) => b.count - a.count || b.score - a.score)
    .map(({ score }) => score);
  const shortcuts: number[] = [];
  for (const score of [...ranked, ...DEFAULT_SCORE_SHORTCUTS]) {
    if (shortcuts.length >= SHORTCUT_COUNT) break;
    if (!shortcuts.includes(score)) shortcuts.push(score);
  }
  return shortcuts;
};
