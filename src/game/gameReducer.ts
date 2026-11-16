import type { Dart, DartSlot, GameState, InputMode, Multiplier, PlayerState, Turn } from "./types";
import { SCORE_MAX, dartValue, emptySlot, isDoubleFinish, isSlotComplete, slotToDart, turnTotal } from "./types";
import { isMatchOver } from "./matchEnd";

export const START_SCORE = 501;

export const createInitialPlayer = (name: string): PlayerState => ({
  name,
  remaining: START_SCORE,
  turns: [],
  legsWon: 0,
  legHistory: [],
});

const emptySlots = (): [DartSlot, DartSlot, DartSlot] => [emptySlot(), emptySlot(), emptySlot()];

const hasMatchInput = (state: GameState): boolean =>
  state.players.some(
    (player) => player.turns.length > 0 || player.legHistory.some((leg) => leg.turns.length > 0)
  ) ||
  state.currentSlots.some((slot) => slot.segment !== null || slot.multiplier !== 1) ||
  state.scoreDraft !== "";

export const createInitialState = (
  nameA: string,
  nameB: string,
  bestOf: number,
  inputMode: InputMode = "darts"
): GameState => ({
  phase: "setup",
  players: [createInitialPlayer(nameA), createInitialPlayer(nameB)],
  activePlayer: 0,
  startingPlayer: 0,
  bestOf,
  inputMode,
  scoreDraft: "",
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
  // Score-Modus: Ziffern der laufenden Aufnahme.
  | { type: "SCORE_DIGIT"; digit: number }
  | { type: "SCORE_BACKSPACE" }
  | { type: "SET_SCORE_DRAFT"; value: string }
  // dartsUsed: Dartzahl des Checkouts im Score-Modus (Popup am Leg-Ende).
  | { type: "CONFIRM_TURN"; dartsUsed?: CheckoutDarts }
  | { type: "UNDO_LAST_TURN" }
  | { type: "EDIT_TURN"; playerIndex: 0 | 1; turnIndex: number }
  | { type: "CONFIRM_EDIT"; dartsUsed?: CheckoutDarts }
  | { type: "CANCEL_EDIT" }
  | { type: "DISMISS_EDIT_ERROR" }
  | { type: "NEXT_LEG" }
  | { type: "UNDO_LEG_RESULT" }
  | { type: "ABORT_MATCH" }
  | { type: "RESET_MATCH"; nameA: string; nameB: string; bestOf: number; inputMode?: InputMode };

export type CheckoutDarts = 1 | 2 | 3;

interface TurnOutcome {
  scoreAfter: number;
  bust: boolean;
  legWon: boolean;
}

const checkoutDartIndex = (darts: Dart[], scoreBefore: number): number | null => {
  let total = 0;
  for (let i = 0; i < darts.length; i++) {
    const dart = darts[i];
    total += dartValue(dart);
    if (total === scoreBefore && isDoubleFinish(dart)) return i;
  }
  return null;
};

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

// Erstes Slot-Abbild für die Auswertung: leere Slots zählen vorläufig als
// 0-Darts. Ob trailing leere Slots wirklich zählen, entscheidet erst das
// finale Turn-Objekt nach der LegWon-Auswertung.
export const confirmedDarts = (slots: [DartSlot, DartSlot, DartSlot]): Dart[] =>
  slots.map((s) =>
    isSlotComplete(s) ? (slotToDart(s) as Dart) : { segment: 0, multiplier: 1 as Multiplier }
  );

// Eine Aufnahme zurück in die Eingabe holen (Rückgängig, Korrektur): im
// Dart-Modus in die Slots, im Score-Modus als Ziffern.
const restoredInput = (
  inputMode: InputMode,
  turn: Turn
): Pick<GameState, "currentSlots" | "scoreDraft"> => {
  if (inputMode === "score") return { currentSlots: emptySlots(), scoreDraft: String(turn.score) };
  const restoredSlots = emptySlots();
  turn.darts.forEach((d, i) => {
    if (i < 3) restoredSlots[i] = { segment: d.segment, multiplier: d.multiplier };
  });
  return { currentSlots: restoredSlots, scoreDraft: "" };
};

// Index des zuletzt tatsächlich AUSGEFÜLLTEN Slots (nicht des letzten in
// der Reihe) - relevant für die Double-Out-Prüfung. -1 wenn alle leer.
export const lastFilledSlotIndex = (slots: [DartSlot, DartSlot, DartSlot]): number => {
  for (let i = slots.length - 1; i >= 0; i--) {
    if (isSlotComplete(slots[i])) return i;
  }
  return -1;
};

const finalizedTurnDarts = (
  darts: Dart[],
  outcome: TurnOutcome,
  scoreBefore: number,
  lastRealDartIndex: number
): Dart[] => {
  // Zentraler Punkt für die Dart-Zählregel: Nur ein Leg-Gewinn schneidet
  // Darts nach dem entscheidenden Double ab. Jede andere Aufnahme behält
  // drei Slots, auch wenn trailing Slots leer als 0-Darts bestätigt wurden.
  if (!outcome.legWon) return darts;
  const finishIndex = checkoutDartIndex(darts, scoreBefore) ?? lastRealDartIndex;
  return darts.slice(0, finishIndex + 1);
};

// ---------- Score-Modus ----------
// Bei Summeneingabe lässt sich das Double nicht prüfen: Rest 0 gilt als
// Checkout, Bust bei Rest < 0 oder Rest 1.
export const evaluateScore = (remaining: number, score: number): TurnOutcome => {
  const newRemaining = remaining - score;
  if (newRemaining < 0 || newRemaining === 1) return { scoreAfter: remaining, bust: true, legWon: false };
  return { scoreAfter: newRemaining, bust: false, legWon: newRemaining === 0 };
};

// Leer oder außerhalb 0..240 (Quadro-Maximum): keine Aufnahme.
export const parseScoreDraft = (draft: string): number | null => {
  if (!/^\d{1,3}$/.test(draft)) return null;
  const score = Number.parseInt(draft, 10);
  return score <= SCORE_MAX ? score : null;
};

const dartsTurn = (darts: Dart[], scoreBefore: number, outcome: TurnOutcome): Turn => ({
  darts,
  score: turnTotal(darts),
  dartCount: darts.length,
  scoreBefore,
  scoreAfter: outcome.scoreAfter,
  bust: outcome.bust,
});

// Im Score-Modus zählt jede Aufnahme drei Darts; nur der Checkout bekommt
// die im Popup gewählte Zahl (ohne Angabe drei).
const scoreTurn = (score: number, scoreBefore: number, outcome: TurnOutcome, dartsUsed?: CheckoutDarts): Turn => ({
  darts: [],
  score,
  dartCount: outcome.legWon ? (dartsUsed ?? 3) : 3,
  scoreBefore,
  scoreAfter: outcome.scoreAfter,
  bust: outcome.bust,
});

// Leg-Abschluss nach einem gültigen Finish (regulär oder per Korrektur):
// Leg in die Historie beider Spieler, legsWon erhöhen, Phase wechseln.
const finishLeg = (state: GameState, winnerIdx: 0 | 1, winner: PlayerState): GameState => {
  const finishedPlayer: PlayerState = {
    ...winner,
    legsWon: winner.legsWon + 1,
    legHistory: [...winner.legHistory, { turns: winner.turns, won: true }],
    turns: [],
  };
  const otherIdx: 0 | 1 = winnerIdx === 0 ? 1 : 0;
  const otherPlayer = state.players[otherIdx];
  const finishedOther: PlayerState = {
    ...otherPlayer,
    legHistory: [...otherPlayer.legHistory, { turns: otherPlayer.turns, won: false }],
    turns: [],
  };
  const finalPlayers: [PlayerState, PlayerState] =
    winnerIdx === 0 ? [finishedPlayer, finishedOther] : [finishedOther, finishedPlayer];

  return {
    ...state,
    players: finalPlayers,
    currentSlots: emptySlots(),
    scoreDraft: "",
    phase: isMatchOver(finalPlayers, state.bestOf) ? "match-finished" : "leg-finished",
  };
};

interface RecalculatedChain {
  turns: Turn[];
  remaining: number;
  invalidReason: string | null;
}

// Ein Leg-Sieg (Rest 0) darf nur beim ursprünglich letzten Turn des Legs
// auftreten - taucht er jetzt schon früher auf, ist die neue Kette
// inkonsistent mit dem Rest des Legs.
const EARLY_WIN = "Diese Änderung würde das Leg vorzeitig beenden.";
const IMPOSSIBLE_LATER_TURN = "Diese Änderung würde eine spätere Aufnahme unmöglich machen.";

const recalculateDartsChain = (
  player: PlayerState,
  turnIndex: number,
  slots: [DartSlot, DartSlot, DartSlot]
): RecalculatedChain => {
  const newDarts = confirmedDarts(slots);
  const lastRealIdx = lastFilledSlotIndex(slots);
  const turns: Turn[] = [];
  let runningScore = player.turns[turnIndex].scoreBefore;

  for (let i = turnIndex; i < player.turns.length; i++) {
    const existingTurn = player.turns[i];
    const candidateDarts = i === turnIndex ? newDarts : existingTurn.darts;
    const lastIdx =
      i === turnIndex
        ? lastRealIdx === -1
          ? 2
          : lastRealIdx
        : checkoutDartIndex(candidateDarts, runningScore) ?? candidateDarts.length - 1;
    if (i > turnIndex && !existingTurn.bust && runningScore - turnTotal(candidateDarts) < 0) {
      return { turns, remaining: runningScore, invalidReason: IMPOSSIBLE_LATER_TURN };
    }
    const outcome = evaluateTurn(runningScore, candidateDarts, lastIdx);
    if (outcome.legWon && i !== player.turns.length - 1) {
      return { turns, remaining: runningScore, invalidReason: EARLY_WIN };
    }
    turns.push(dartsTurn(finalizedTurnDarts(candidateDarts, outcome, runningScore, lastIdx), runningScore, outcome));
    runningScore = outcome.scoreAfter;
  }
  return { turns, remaining: runningScore, invalidReason: null };
};

// null: kein gültiger Score eingegeben, die Korrektur bleibt offen.
const recalculateScoreChain = (
  player: PlayerState,
  turnIndex: number,
  newScore: number | null,
  dartsUsed?: CheckoutDarts
): RecalculatedChain | null => {
  if (newScore === null) return null;
  const turns: Turn[] = [];
  let runningScore = player.turns[turnIndex].scoreBefore;

  for (let i = turnIndex; i < player.turns.length; i++) {
    const existingTurn = player.turns[i];
    const score = i === turnIndex ? newScore : existingTurn.score;
    if (i > turnIndex && !existingTurn.bust && runningScore - score < 0) {
      return { turns, remaining: runningScore, invalidReason: IMPOSSIBLE_LATER_TURN };
    }
    const outcome = evaluateScore(runningScore, score);
    if (outcome.legWon && i !== player.turns.length - 1) {
      return { turns, remaining: runningScore, invalidReason: EARLY_WIN };
    }
    // Spätere Aufnahmen behalten ihre Dartzahl; die bearbeitete bekommt
    // die neu gewählte, sonst die bisherige.
    const checkoutDarts = i === turnIndex ? (dartsUsed ?? (existingTurn.dartCount as CheckoutDarts)) : (existingTurn.dartCount as CheckoutDarts);
    turns.push(scoreTurn(score, runningScore, outcome, checkoutDarts));
    runningScore = outcome.scoreAfter;
  }
  return { turns, remaining: runningScore, invalidReason: null };
};

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case "RESET_MATCH": {
      return createInitialState(action.nameA, action.nameB, action.bestOf, action.inputMode);
    }

    case "ABORT_MATCH": {
      return createInitialState(state.players[0].name, state.players[1].name, state.bestOf, state.inputMode);
    }

    case "SWITCH_STARTING_PLAYER": {
      if (state.phase !== "setup" && (state.phase !== "playing" || hasMatchInput(state))) return state;
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

    case "SCORE_DIGIT": {
      if (state.phase !== "playing") return state;
      // Eine führende 0 wird ersetzt, sonst hängt die Ziffer hinten an.
      const next = (state.scoreDraft === "0" ? "" : state.scoreDraft) + String(action.digit);
      return parseScoreDraft(next) === null ? state : { ...state, scoreDraft: next };
    }

    case "SCORE_BACKSPACE": {
      if (state.phase !== "playing") return state;
      return { ...state, scoreDraft: state.scoreDraft.slice(0, -1) };
    }

    case "SET_SCORE_DRAFT": {
      if (state.phase !== "playing") return state;
      return parseScoreDraft(action.value) === null ? state : { ...state, scoreDraft: action.value };
    }

    case "CONFIRM_TURN": {
      if (state.phase !== "playing" || state.editingTurn) return state;
      const activeIdx = state.activePlayer;
      const player = state.players[activeIdx];

      let turn: Turn;
      if (state.inputMode === "score") {
        const score = parseScoreDraft(state.scoreDraft);
        if (score === null) return state;
        const outcome = evaluateScore(player.remaining, score);
        turn = scoreTurn(score, player.remaining, outcome, action.dartsUsed);
      } else {
        const candidateDarts = confirmedDarts(state.currentSlots);
        const lastRealIdx = lastFilledSlotIndex(state.currentSlots);
        const lastRealDartIndex = lastRealIdx === -1 ? 2 : lastRealIdx;
        const outcome = evaluateTurn(player.remaining, candidateDarts, lastRealDartIndex);
        turn = dartsTurn(
          finalizedTurnDarts(candidateDarts, outcome, player.remaining, lastRealDartIndex),
          player.remaining,
          outcome
        );
      }

      const updatedPlayer: PlayerState = {
        ...player,
        remaining: turn.scoreAfter,
        turns: [...player.turns, turn],
      };

      if (turn.scoreAfter === 0 && !turn.bust) return finishLeg(state, activeIdx, updatedPlayer);

      const players: [PlayerState, PlayerState] =
        activeIdx === 0 ? [updatedPlayer, state.players[1]] : [state.players[0], updatedPlayer];
      return {
        ...state,
        players,
        currentSlots: emptySlots(),
        scoreDraft: "",
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

      return {
        ...state,
        players,
        activePlayer: lastPlayerIdx,
        ...restoredInput(state.inputMode, lastTurn),
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

      return {
        ...state,
        ...restoredInput(state.inputMode, targetTurn),
        editingTurn: { playerIndex: action.playerIndex, turnIndex: action.turnIndex },
        editError: null,
      };
    }

    case "CANCEL_EDIT": {
      if (!state.editingTurn) return state;
      return { ...state, currentSlots: emptySlots(), scoreDraft: "", editingTurn: null };
    }

    case "DISMISS_EDIT_ERROR": {
      return { ...state, editError: null };
    }

    // Übernimmt die bearbeitete Aufnahme (Darts oder Score). Nur diese eine
    // Aufnahme wird ersetzt - alle folgenden Aufnahmen des Spielers bleiben
    // mit ihren eigenen Werten erhalten, ihre Restpunktzahl-Kette
    // (scoreBefore/scoreAfter/bust) wird ab hier neu durchgerechnet. Würde
    // dabei eine spätere Aufnahme rechnerisch unmöglich (negativer Rest,
    // oder ein Leg-Sieg der jetzt an anderer Stelle läge), wird die gesamte
    // Änderung verworfen und editError gesetzt.
    case "CONFIRM_EDIT": {
      if (state.phase !== "playing" || !state.editingTurn) return state;
      const { playerIndex, turnIndex } = state.editingTurn;
      const player = state.players[playerIndex];
      const targetTurn = player.turns[turnIndex];
      if (!targetTurn) return { ...state, editingTurn: null, currentSlots: emptySlots(), scoreDraft: "" };

      const chain =
        state.inputMode === "score"
          ? recalculateScoreChain(player, turnIndex, parseScoreDraft(state.scoreDraft), action.dartsUsed)
          : recalculateDartsChain(player, turnIndex, state.currentSlots);
      if (chain === null) return state;
      if (chain.invalidReason) return { ...state, editError: chain.invalidReason };

      const updatedPlayer: PlayerState = {
        ...player,
        remaining: chain.remaining,
        turns: [...player.turns.slice(0, turnIndex), ...chain.turns],
      };
      const cleared = { ...state, editingTurn: null, editError: null };

      // War die bearbeitete Aufnahme (bzw. eine der neu durchgerechneten
      // danach) jetzt tatsächlich ein gültiges Finish, muss derselbe
      // Leg-Abschluss wie bei einer regulär bestätigten Aufnahme greifen.
      const legJustWon = chain.turns.length > 0 && chain.turns[chain.turns.length - 1].scoreAfter === 0;
      if (legJustWon) return finishLeg(cleared, playerIndex, updatedPlayer);

      const players: [PlayerState, PlayerState] =
        playerIndex === 0 ? [updatedPlayer, state.players[1]] : [state.players[0], updatedPlayer];
      return { ...cleared, players, currentSlots: emptySlots(), scoreDraft: "" };
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

    // Nimmt einen gerade erfolgten Leg-Abschluss vollständig zurück
    // ("Rückgängig" im Leg-/Match-Ende-Popup): das zuletzt abgeschlossene
    // Leg wandert bei BEIDEN Spielern aus legHistory zurück in die laufenden
    // Turns, legsWon des Siegers sinkt wieder, die Phase geht auf "playing".
    // Die Punktestände bleiben so, wie sie beim Leg-Ende waren (Sieger 0) -
    // erst die Korrektur der fraglichen Aufnahme über die Score-Liste
    // (EDIT_TURN/CONFIRM_EDIT) rechnet die Kette neu durch.
    case "UNDO_LEG_RESULT": {
      if (state.phase !== "leg-finished" && state.phase !== "match-finished") return state;
      if (state.players.every((player) => player.legHistory.length === 0)) return state;

      const players = state.players.map((player) => {
        const lastLeg = player.legHistory.at(-1);
        if (!lastLeg) return player;
        return {
          ...player,
          turns: lastLeg.turns,
          legsWon: lastLeg.won ? player.legsWon - 1 : player.legsWon,
          legHistory: player.legHistory.slice(0, -1),
        };
      }) as [PlayerState, PlayerState];

      // Wer als nächstes wirft, ergibt sich aus den wiederhergestellten
      // Aufnahmen: der Starter beginnt, danach wird abwechselnd geworfen.
      const otherIdx: 0 | 1 = state.startingPlayer === 0 ? 1 : 0;
      const activePlayer: 0 | 1 =
        players[state.startingPlayer].turns.length > players[otherIdx].turns.length
          ? otherIdx
          : state.startingPlayer;

      return {
        ...state,
        players,
        activePlayer,
        currentSlots: emptySlots(),
        editingTurn: null,
        editError: null,
        phase: "playing",
      };
    }

    default:
      return state;
  }
};

export const dartsAsScore = (darts: Dart[]) => turnTotal(darts);
export { dartValue };
