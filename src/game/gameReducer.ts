import type { Dart, DartSlot, GameState, Multiplier, PlayerState, Turn } from "./types";
import { dartValue, emptySlot, isDoubleFinish, isSlotComplete, slotToDart, turnTotal } from "./types";

export const START_SCORE = 501;

export const createInitialPlayer = (name: string): PlayerState => ({
  name,
  remaining: START_SCORE,
  turns: [],
  legsWon: 0,
  legHistory: [],
});

const emptySlots = (): [DartSlot, DartSlot, DartSlot] => [emptySlot(), emptySlot(), emptySlot()];

export const createInitialState = (
  nameA: string,
  nameB: string,
  legsToWin: number
): GameState => ({
  phase: "setup",
  players: [createInitialPlayer(nameA), createInitialPlayer(nameB)],
  activePlayer: 0,
  startingPlayer: 0,
  legsToWin,
  currentSlots: emptySlots(),
  editingTurn: null,
  editError: null,
});

export type GameAction =
  | { type: "START_MATCH" }
  | { type: "SWITCH_STARTING_PLAYER" }
  | { type: "SET_SLOT_SEGMENT"; index: number; segment: number }
  | { type: "SET_SLOT_MULTIPLIER"; index: number; multiplier: Multiplier }
  | { type: "CLEAR_SLOT"; index: number }
  | { type: "CONFIRM_TURN" }
  | { type: "UNDO_LAST_TURN" }
  | { type: "EDIT_TURN"; playerIndex: 0 | 1; turnIndex: number }
  | { type: "CONFIRM_EDIT" }
  | { type: "CANCEL_EDIT" }
  | { type: "DISMISS_EDIT_ERROR" }
  | { type: "NEXT_LEG" }
  | { type: "ABORT_MATCH" }
  | { type: "RESET_MATCH"; nameA: string; nameB: string; legsToWin: number };

interface TurnOutcome {
  scoreAfter: number;
  bust: boolean;
  legWon: boolean;
}

// Berechnet das Ergebnis einer Aufnahme nach Double-Out-Regeln.
// Bust wenn: Rest < 0, Rest === 1, oder Rest === 0 aber letzter Dart kein Double.
// lastRealDartIndex gibt an, welcher der 3 Darts der zuletzt tatsächlich
// EINGEGEBENE war (nicht zwangsläufig darts[2] - Slots können mit 0
// aufgefüllt sein, wenn z.B. nur Dart 1 und 3 ausgefüllt wurden). Für die
// Double-Out-Prüfung zählt dieser Dart, nicht der letzte in der Reihe.
export const evaluateTurn = (
  remaining: number,
  darts: Dart[],
  lastRealDartIndex: number = darts.length - 1
): TurnOutcome => {
  const thrown = turnTotal(darts);
  const newRemaining = remaining - thrown;
  const lastDart = darts[lastRealDartIndex];

  if (newRemaining < 0 || newRemaining === 1) {
    return { scoreAfter: remaining, bust: true, legWon: false };
  }
  if (newRemaining === 0) {
    if (lastDart && isDoubleFinish(lastDart)) {
      return { scoreAfter: 0, bust: false, legWon: true };
    }
    return { scoreAfter: remaining, bust: true, legWon: false };
  }
  return { scoreAfter: newRemaining, bust: false, legWon: false };
};

// Begrenzt den Multiplikator eines Slots je nach Segment: Bull (25) nur
// x1/x2, Miss (0) immer x1, normale Segmente x1-x4.
const clampMultiplier = (segment: number | null, multiplier: Multiplier): Multiplier => {
  if (segment === 0) return 1;
  if (segment === 25 && multiplier > 2) return 2;
  return multiplier;
};

// Wandelt die aktuellen Slots in vollständige Darts um. Jede der 3
// Positionen wird zurückgegeben - unbefüllte Slots werden mit 0 (Fehlwurf)
// aufgefüllt, egal an welcher Position sie liegen. Das erhält die Reihen-
// folge für die Anzeige (54 54 20 statt nur 54 54 20 ohne Lücken).
export const confirmedDarts = (slots: [DartSlot, DartSlot, DartSlot]): Dart[] =>
  slots.map((s) => (isSlotComplete(s) ? (slotToDart(s) as Dart) : { segment: 0, multiplier: 1 as Multiplier }));

// Index des zuletzt tatsächlich AUSGEFÜLLTEN Slots (nicht des letzten in
// der Reihe) - relevant für die Double-Out-Prüfung. -1 wenn alle leer.
export const lastFilledSlotIndex = (slots: [DartSlot, DartSlot, DartSlot]): number => {
  for (let i = slots.length - 1; i >= 0; i--) {
    if (isSlotComplete(slots[i])) return i;
  }
  return -1;
};

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case "RESET_MATCH": {
      return createInitialState(action.nameA, action.nameB, action.legsToWin);
    }

    case "ABORT_MATCH": {
      return createInitialState(state.players[0].name, state.players[1].name, state.legsToWin);
    }

    case "SWITCH_STARTING_PLAYER": {
      if (state.phase !== "setup") return state;
      const newStarting = state.startingPlayer === 0 ? 1 : 0;
      return { ...state, startingPlayer: newStarting, activePlayer: newStarting };
    }

    case "START_MATCH": {
      return { ...state, phase: "playing" };
    }

    // Zahl für einen Slot setzen. Reihenfolge egal — kann vor oder nach dem
    // Multiplikator kommen. Der Slot muss noch keine Zahl haben, sonst wird
    // sie ersetzt (Korrektur).
    case "SET_SLOT_SEGMENT": {
      if (state.phase !== "playing") return state;
      const slot = state.currentSlots[action.index];
      if (!slot) return state;
      const newSlot: DartSlot = {
        segment: action.segment,
        multiplier: clampMultiplier(action.segment, slot.multiplier),
      };
      const currentSlots = state.currentSlots.map((s, i) =>
        i === action.index ? newSlot : s
      ) as [DartSlot, DartSlot, DartSlot];
      return { ...state, currentSlots };
    }

    // Multiplikator für einen Slot setzen/togglen. Kann auch gesetzt werden
    // bevor die Zahl feststeht (Multiplikator wird vorgemerkt).
    case "SET_SLOT_MULTIPLIER": {
      if (state.phase !== "playing") return state;
      const slot = state.currentSlots[action.index];
      if (!slot) return state;
      const nextMultiplier: Multiplier = slot.multiplier === action.multiplier ? 1 : action.multiplier;
      const newSlot: DartSlot = {
        segment: slot.segment,
        multiplier: clampMultiplier(slot.segment, nextMultiplier),
      };
      const currentSlots = state.currentSlots.map((s, i) =>
        i === action.index ? newSlot : s
      ) as [DartSlot, DartSlot, DartSlot];
      return { ...state, currentSlots };
    }

    case "CLEAR_SLOT": {
      if (state.phase !== "playing") return state;
      const currentSlots = state.currentSlots.map((s, i) =>
        i === action.index ? emptySlot() : s
      ) as [DartSlot, DartSlot, DartSlot];
      return { ...state, currentSlots };
    }

    case "CONFIRM_TURN": {
      if (state.phase !== "playing" || state.editingTurn) return state;
      const darts = confirmedDarts(state.currentSlots);
      const lastRealIdx = lastFilledSlotIndex(state.currentSlots);

      const activeIdx = state.activePlayer;
      const player = state.players[activeIdx];
      const outcome = evaluateTurn(player.remaining, darts, lastRealIdx === -1 ? 2 : lastRealIdx);
      const turn: Turn = {
        darts,
        scoreBefore: player.remaining,
        scoreAfter: outcome.scoreAfter,
        bust: outcome.bust,
      };

      const updatedPlayer: PlayerState = {
        ...player,
        remaining: outcome.scoreAfter,
        turns: [...player.turns, turn],
      };

      const players: [PlayerState, PlayerState] =
        activeIdx === 0 ? [updatedPlayer, state.players[1]] : [state.players[0], updatedPlayer];

      if (outcome.legWon) {
        const finishedPlayer: PlayerState = {
          ...updatedPlayer,
          legsWon: updatedPlayer.legsWon + 1,
          legHistory: [...updatedPlayer.legHistory, { turns: updatedPlayer.turns, won: true }],
          turns: [],
        };
        const otherIdx: 0 | 1 = activeIdx === 0 ? 1 : 0;
        const otherPlayer = state.players[otherIdx];
        const finishedOther: PlayerState = {
          ...otherPlayer,
          legHistory: [...otherPlayer.legHistory, { turns: otherPlayer.turns, won: false }],
          turns: [],
        };
        const finalPlayers: [PlayerState, PlayerState] =
          activeIdx === 0 ? [finishedPlayer, finishedOther] : [finishedOther, finishedPlayer];

        const matchWon = finishedPlayer.legsWon >= state.legsToWin;

        return {
          ...state,
          players: finalPlayers,
          currentSlots: emptySlots(),
          phase: matchWon ? "match-finished" : "leg-finished",
        };
      }

      return {
        ...state,
        players,
        currentSlots: emptySlots(),
        activePlayer: activeIdx === 0 ? 1 : 0,
      };
    }

    // Korrigiert die zuletzt bestätigte Aufnahme: die Aufnahme wird aus der
    // Historie entfernt, der Punktestand des betroffenen Spielers
    // zurückgesetzt, die Darts wandern zurück in die aktuelle Eingabe.
    // Mehrfach hintereinander drückbar - eine eventuell laufende Eingabe
    // wird dabei verworfen zugunsten der letzten bestätigten Aufnahme.
    case "UNDO_LAST_TURN": {
      if (state.phase !== "playing" || state.editingTurn) return state;
      const lastPlayerIdx: 0 | 1 = state.activePlayer === 0 ? 1 : 0;
      const player = state.players[lastPlayerIdx];
      if (player.turns.length === 0) return state;

      const lastTurn = player.turns[player.turns.length - 1];
      const updatedPlayer: PlayerState = {
        ...player,
        remaining: lastTurn.scoreBefore,
        turns: player.turns.slice(0, -1),
      };

      const players: [PlayerState, PlayerState] =
        lastPlayerIdx === 0 ? [updatedPlayer, state.players[1]] : [state.players[0], updatedPlayer];

      const restoredSlots = emptySlots();
      lastTurn.darts.forEach((d, i) => {
        if (i < 3) restoredSlots[i] = { segment: d.segment, multiplier: d.multiplier };
      });

      return {
        ...state,
        players,
        activePlayer: lastPlayerIdx,
        currentSlots: restoredSlots,
      };
    }

    // Öffnet eine beliebige Aufnahme des AKTUELL LAUFENDEN Legs erneut zur
    // Bearbeitung (Klick in der Score-Liste). Die Darts dieser Aufnahme
    // wandern zur Bearbeitung in currentSlots - alle anderen Aufnahmen
    // bleiben unangetastet, bis CONFIRM_EDIT bestätigt wird.
    // Bereits abgeschlossene Legs (legHistory) sind davon nicht betroffen.
    case "EDIT_TURN": {
      if (state.phase !== "playing" || state.editingTurn) return state;
      const player = state.players[action.playerIndex];
      const targetTurn = player.turns[action.turnIndex];
      if (!targetTurn) return state;

      const restoredSlots = emptySlots();
      targetTurn.darts.forEach((d, i) => {
        if (i < 3) restoredSlots[i] = { segment: d.segment, multiplier: d.multiplier };
      });

      return {
        ...state,
        currentSlots: restoredSlots,
        editingTurn: { playerIndex: action.playerIndex, turnIndex: action.turnIndex },
        editError: null,
      };
    }

    case "CANCEL_EDIT": {
      if (!state.editingTurn) return state;
      return { ...state, currentSlots: emptySlots(), editingTurn: null };
    }

    case "DISMISS_EDIT_ERROR": {
      return { ...state, editError: null };
    }

    // Übernimmt die bearbeiteten Darts einer bereits bestätigten Aufnahme.
    // Nur diese eine Aufnahme wird ersetzt - alle folgenden Aufnahmen des
    // Spielers bleiben mit ihren eigenen Darts erhalten, ihre Restpunktzahl-
    // Kette (scoreBefore/scoreAfter/bust) wird ab hier neu durchgerechnet.
    // Würde dabei eine spätere Aufnahme rechnerisch unmöglich (negativer
    // Rest, oder ein Leg-Sieg der jetzt an anderer Stelle läge), wird die
    // gesamte Änderung verworfen und editError gesetzt.
    case "CONFIRM_EDIT": {
      if (state.phase !== "playing" || !state.editingTurn) return state;
      const { playerIndex, turnIndex } = state.editingTurn;
      const player = state.players[playerIndex];
      const targetTurn = player.turns[turnIndex];
      if (!targetTurn) return { ...state, editingTurn: null, currentSlots: emptySlots() };

      const newDarts = confirmedDarts(state.currentSlots);
      const lastRealIdx = lastFilledSlotIndex(state.currentSlots);

      // Kette ab turnIndex neu durchrechnen: der bearbeitete Turn und alle
      // danach behalten ihre bisherigen Darts (außer dem bearbeiteten
      // selbst), aber scoreBefore/scoreAfter/bust werden frisch berechnet.
      const scoreBeforeEdit = targetTurn.scoreBefore;
      const recalculated: Turn[] = [];
      let runningScore = scoreBeforeEdit;
      let invalidReason: string | null = null;

      for (let i = turnIndex; i < player.turns.length; i++) {
        const darts = i === turnIndex ? newDarts : player.turns[i].darts;
        const lastIdx = i === turnIndex ? (lastRealIdx === -1 ? 2 : lastRealIdx) : darts.length - 1;
        if (i > turnIndex && runningScore - turnTotal(darts) < 0) {
          invalidReason = "Diese Änderung würde eine spätere Aufnahme unmöglich machen.";
          break;
        }
        const outcome = evaluateTurn(runningScore, darts, lastIdx);

        // Ein Leg-Sieg (Rest 0 mit gültigem Double) darf nur beim
        // ursprünglich letzten Turn des Legs auftreten - taucht er jetzt
        // schon früher oder gar nicht mehr an der ursprünglichen Stelle
        // auf, ist die neue Kette inkonsistent mit dem Rest des Legs.
        const isOriginallyLastTurn = i === player.turns.length - 1;
        const wouldWinLeg = outcome.scoreAfter === 0 && !outcome.bust;
        if (wouldWinLeg && !isOriginallyLastTurn) {
          invalidReason = "Diese Änderung würde das Leg vorzeitig beenden.";
          break;
        }

        recalculated.push({
          darts,
          scoreBefore: runningScore,
          scoreAfter: outcome.scoreAfter,
          bust: outcome.bust,
        });
        runningScore = outcome.scoreAfter;
      }

      if (invalidReason) {
        return { ...state, editError: invalidReason };
      }

      const legJustWon = recalculated.length > 0 && recalculated[recalculated.length - 1].scoreAfter === 0;

      const updatedPlayer: PlayerState = {
        ...player,
        remaining: runningScore,
        turns: [...player.turns.slice(0, turnIndex), ...recalculated],
      };

      // War die bearbeitete Aufnahme (bzw. eine der neu durchgerechneten
      // danach) jetzt tatsächlich ein gültiges Finish, muss derselbe
      // Leg-Abschluss wie bei einer regulär bestätigten Aufnahme greifen:
      // Leg in die Historie verschieben, legsWon erhöhen, Phase wechseln.
      if (legJustWon) {
        const finishedPlayer: PlayerState = {
          ...updatedPlayer,
          legsWon: updatedPlayer.legsWon + 1,
          legHistory: [...updatedPlayer.legHistory, { turns: updatedPlayer.turns, won: true }],
          turns: [],
        };
        const otherIdx: 0 | 1 = playerIndex === 0 ? 1 : 0;
        const otherPlayer = state.players[otherIdx];
        const finishedOther: PlayerState = {
          ...otherPlayer,
          legHistory: [...otherPlayer.legHistory, { turns: otherPlayer.turns, won: false }],
          turns: [],
        };
        const finalPlayers: [PlayerState, PlayerState] =
          playerIndex === 0 ? [finishedPlayer, finishedOther] : [finishedOther, finishedPlayer];

        const matchWon = finishedPlayer.legsWon >= state.legsToWin;

        return {
          ...state,
          players: finalPlayers,
          currentSlots: emptySlots(),
          editingTurn: null,
          editError: null,
          phase: matchWon ? "match-finished" : "leg-finished",
        };
      }

      const players: [PlayerState, PlayerState] =
        playerIndex === 0 ? [updatedPlayer, state.players[1]] : [state.players[0], updatedPlayer];

      return {
        ...state,
        players,
        currentSlots: emptySlots(),
        editingTurn: null,
        editError: null,
      };
    }

    case "NEXT_LEG": {
      if (state.phase !== "leg-finished") return state;
      const nextStarting = state.startingPlayer === 0 ? 1 : 0;
      const resetPlayers: [PlayerState, PlayerState] = [
        { ...state.players[0], remaining: START_SCORE, turns: [] },
        { ...state.players[1], remaining: START_SCORE, turns: [] },
      ];
      return {
        ...state,
        players: resetPlayers,
        startingPlayer: nextStarting,
        activePlayer: nextStarting,
        currentSlots: emptySlots(),
        phase: "playing",
      };
    }

    default:
      return state;
  }
};

export const dartsAsScore = (darts: Dart[]) => turnTotal(darts);
export { dartValue };
