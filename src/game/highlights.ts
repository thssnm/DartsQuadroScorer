import type { GameState, PlayerState, Turn } from "./types";
import { turnTotal } from "./types";
import { dartsInTurns } from "./dartCount";

const FAST_LEG_DART_LIMIT = 18;
const HIGH_FINISH_MINIMUM = 100;
const HIGH_TURN_MINIMUM = 170;

const isCheckoutTurn = (leg: PlayerState["legHistory"][number], turn: Turn, turnIndex: number): boolean =>
  leg.won && turnIndex === leg.turns.length - 1 && !turn.bust && turn.scoreAfter === 0;

const legStartingPlayer = (state: GameState, legIndex: number, legCount: number): 0 | 1 => {
  const distanceFromFinalLeg = legCount - 1 - legIndex;
  if (distanceFromFinalLeg % 2 === 0) return state.startingPlayer;
  return state.startingPlayer === 0 ? 1 : 0;
};

export const computeHighlights = (state: GameState): string[] => {
  const highlights: string[] = [];
  const legCount = Math.max(state.players[0].legHistory.length, state.players[1].legHistory.length);

  for (let legIndex = 0; legIndex < legCount; legIndex++) {
    const startingPlayer = legStartingPlayer(state, legIndex, legCount);
    const otherPlayer = startingPlayer === 0 ? 1 : 0;
    const turnCount = Math.max(
      state.players[0].legHistory[legIndex]?.turns.length ?? 0,
      state.players[1].legHistory[legIndex]?.turns.length ?? 0
    );

    for (let turnIndex = 0; turnIndex < turnCount; turnIndex++) {
      for (const playerIndex of [startingPlayer, otherPlayer]) {
        const player = state.players[playerIndex];
        const leg = player.legHistory[legIndex];
        const turn = leg?.turns[turnIndex];
        if (!leg || !turn) continue;

        const total = turnTotal(turn.darts);
        if (isCheckoutTurn(leg, turn, turnIndex)) {
          const darts = dartsInTurns(leg.turns);
          if (darts <= FAST_LEG_DART_LIMIT) {
            highlights.push(`${darts} Darts (${player.name})`);
          }
          if (total > HIGH_FINISH_MINIMUM) {
            highlights.push(`${total} Finish (${player.name})`);
          }
        }
        if (!turn.bust && total > HIGH_TURN_MINIMUM) {
          highlights.push(`${total} (${player.name})`);
        }
      }
    }
  }

  return highlights;
};
