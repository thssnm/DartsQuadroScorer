export type Multiplier = 1 | 2 | 3 | 4;

// Einzelner Dart-Wurf. segment: 0 = Miss, 1-20 = Zahl, 25 = Bull.
// Bull kann nur x1 (25) oder x2 (50) sein, kein x3/x4.
export interface Dart {
  segment: number;
  multiplier: Multiplier;
}

// Ein Slot der aktuellen Aufnahme kann teilweise befüllt sein: nur die
// Zahl gesetzt (Multiplikator noch offen, Default x1) oder nur der
// Multiplikator vorgewählt (Zahl noch offen). null = komplett leer.
export interface DartSlot {
  segment: number | null;
  multiplier: Multiplier;
}

export const emptySlot = (): DartSlot => ({ segment: null, multiplier: 1 });

export const isSlotComplete = (slot: DartSlot): slot is DartSlot & { segment: number } =>
  slot.segment !== null;

export const slotToDart = (slot: DartSlot): Dart | null =>
  isSlotComplete(slot) ? { segment: slot.segment, multiplier: slot.multiplier } : null;

export interface Turn {
  darts: Dart[];
  scoreBefore: number;
  scoreAfter: number;
  bust: boolean;
}

// Ein abgeschlossenes Leg: die Turns, die während des Legs geworfen wurden.
export interface CompletedLeg {
  turns: Turn[];
  won: boolean;
}

export interface PlayerState {
  name: string;
  remaining: number;
  turns: Turn[]; // Turns des laufenden Legs
  legsWon: number;
  legHistory: CompletedLeg[]; // abgeschlossene Legs (für Spiel-Ø, Best-Leg)
}

export type GamePhase = "setup" | "playing" | "leg-finished" | "match-finished";

export interface GameState {
  phase: GamePhase;
  players: [PlayerState, PlayerState];
  activePlayer: 0 | 1;
  startingPlayer: 0 | 1;
  legsToWin: number; // z.B. 2 bei "Best of 3"
  currentSlots: [DartSlot, DartSlot, DartSlot]; // die 3 Darts der laufenden Aufnahme
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
