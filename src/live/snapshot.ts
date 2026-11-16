import { dartsInTurns } from "../game/dartCount";
import { computePlayerStats } from "../game/stats";
import type { GameState, PlayerState } from "../game/types";

export type LiveStatus = "live" | "finished";

// Ein Datensatz der livescore-Collection.
export interface LiveSnapshot {
  matchId: string;
  boardName: string;
  home: string;
  guest: string;
  legsHome: number;
  legsGuest: number;
  scoreHome: number;
  scoreGuest: number;
  dartsHome: number;
  dartsGuest: number;
  bestOf: number;
  averageHome?: number;
  averageGuest?: number;
  activePlayer: "home" | "guest";
  status: LiveStatus;
}

// Spiel-Ø wie in der Statistik. Anders als beim Ergebnis-Upload zählt ein
// Ø von 0 mit, sobald Darts geworfen sind - nur ohne Darts fehlt das Feld.
const liveAverage = (player: PlayerState): number | undefined => {
  const darts = dartsInTurns([...player.legHistory.flatMap((leg) => leg.turns), ...player.turns]);
  if (darts === 0) return undefined;
  return Math.round(computePlayerStats(player).matchAverage * 10) / 10;
};

// Darts im laufenden Leg. Nach dem Checkout liegen die Aufnahmen beider
// Spieler schon in legHistory - bis "Nächstes Leg" zeigt der Ticker weiter
// das gerade beendete Leg (z.B. 10 beim 10-Darter). Die Dart-Zählregel
// (drei Darts pro Aufnahme, beim Checkout nur bis zum Double) steckt
// bereits in den gespeicherten Turns.
const dartsInLeg = (state: GameState, player: PlayerState): number => {
  if (state.phase === "leg-finished" || state.phase === "match-finished") {
    return dartsInTurns(player.legHistory.at(-1)?.turns ?? []);
  }
  return dartsInTurns(player.turns);
};

// status ist "finished" erst nach "Weiter zur Statistik" (match-confirmed):
// Leg- und Match-Ende-Popup lassen sich noch per "Rückgängig" zurücknehmen.
export const buildLiveSnapshot = (
  state: GameState,
  boardName: string,
  matchId: string,
  matchConfirmed = false
): LiveSnapshot => {
  const [home, guest] = state.players;
  const averageHome = liveAverage(home);
  const averageGuest = liveAverage(guest);
  return {
    matchId,
    boardName,
    home: home.name,
    guest: guest.name,
    legsHome: home.legsWon,
    legsGuest: guest.legsWon,
    scoreHome: home.remaining,
    scoreGuest: guest.remaining,
    dartsHome: dartsInLeg(state, home),
    dartsGuest: dartsInLeg(state, guest),
    bestOf: state.bestOf,
    ...(averageHome === undefined ? {} : { averageHome }),
    ...(averageGuest === undefined ? {} : { averageGuest }),
    activePlayer: state.activePlayer === 0 ? "home" : "guest",
    status: matchConfirmed && state.phase === "match-finished" ? "finished" : "live",
  };
};

const SNAPSHOT_KEYS: (keyof LiveSnapshot)[] = [
  "matchId",
  "boardName",
  "home",
  "guest",
  "legsHome",
  "legsGuest",
  "scoreHome",
  "scoreGuest",
  "dartsHome",
  "dartsGuest",
  "bestOf",
  "averageHome",
  "averageGuest",
  "activePlayer",
  "status",
];

export const sameSnapshot = (a: LiveSnapshot | null, b: LiveSnapshot | null): boolean =>
  a === b || (a !== null && b !== null && SNAPSHOT_KEYS.every((key) => a[key] === b[key]));
