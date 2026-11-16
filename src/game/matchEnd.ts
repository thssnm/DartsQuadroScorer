import type { GameState, PlayerState } from "./types";

// Ein Match über "Best of N" Legs ist beendet, sobald ein Spieler mehr als
// die Hälfte der Legs hat oder alle Legs gespielt sind. Bei geradem N kann
// es damit unentschieden ausgehen (Best of 2: 1:1), bei ungeradem N ist das
// dieselbe Regel wie "wer zuerst ceil(N/2) Legs hat".
export const isMatchOver = (players: [PlayerState, PlayerState], bestOf: number): boolean => {
  const [a, b] = players;
  return a.legsWon * 2 > bestOf || b.legsWon * 2 > bestOf || a.legsWon + b.legsWon >= bestOf;
};

// Sieger eines Matches, null bei Gleichstand.
export const matchWinner = (state: GameState): PlayerState | null => {
  const [a, b] = state.players;
  if (a.legsWon === b.legsWon) return null;
  return a.legsWon > b.legsWon ? a : b;
};

export const matchTitle = (state: GameState): string => {
  const winner = matchWinner(state);
  return winner ? `${winner.name} gewinnt das Match!` : "Unentschieden!";
};
