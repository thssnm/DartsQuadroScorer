export type Multiplier = 1 | 2 | 3 | 4;

// Einzelner Dart-Wurf. segment: 0 = Miss, 1-20 = Zahl, 25 = Bull.
// Bull kann nur x1 (25) oder x2 (50) sein, kein x3/x4.
export interface Dart {
  segment: number;
  multiplier: Multiplier;
}

export interface Turn {
  darts: Dart[];
  scoreBefore: number;
  scoreAfter: number;
  bust: boolean;
}

export interface PlayerState {
  name: string;
  remaining: number;
  turns: Turn[];
  legsWon: number;
}

export type GamePhase = "setup" | "playing" | "leg-finished" | "match-finished";

export interface GameState {
  phase: GamePhase;
  players: [PlayerState, PlayerState];
  activePlayer: 0 | 1;
  startingPlayer: 0 | 1;
  legsToWin: number; // z.B. 2 bei "Best of 3"
  currentLegDarts: Dart[]; // Darts des laufenden Aufnahme (max 3)
}

export const dartValue = (dart: Dart): number => {
  if (dart.segment === 0) return 0;
  if (dart.segment === 25) return dart.multiplier >= 2 ? 50 : 25;
  return dart.segment * dart.multiplier;
};

export const turnTotal = (darts: Dart[]): number =>
  darts.reduce((sum, d) => sum + dartValue(d), 0);

// Double-Out prüfen: letzter geworfener Dart muss ein Double sein
// (Segment x2, oder Bull mit multiplier 2 = 50)
export const isDoubleFinish = (dart: Dart): boolean =>
  dart.multiplier === 2 && dart.segment !== 0;
