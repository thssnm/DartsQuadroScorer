import type { Dart, Turn } from "./types";
import { dartValue, isDoubleFinish } from "./types";

export const checkoutDartIndex = (darts: Dart[], scoreBefore: number): number | null => {
  let total = 0;
  for (let i = 0; i < darts.length; i++) {
    const dart = darts[i];
    total += dartValue(dart);
    if (total === scoreBefore && isDoubleFinish(dart)) return i;
  }
  return null;
};

export const dartsInTurn = (turn: Turn): number => {
  // Alte gespeicherte Kurz-Finishes können noch mit aufgefüllten 0-Darts
  // enden. Für Statistiken zählt dann der Dart, der das Checkout erreicht.
  if (!turn.bust && turn.scoreAfter === 0) {
    const finishIndex = checkoutDartIndex(turn.darts, turn.scoreBefore);
    if (finishIndex !== null) return finishIndex + 1;
  }
  return turn.darts.length;
};

export const dartsInTurns = (turns: Turn[]): number =>
  turns.reduce((sum, turn) => sum + dartsInTurn(turn), 0);
