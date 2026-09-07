import type { DartSlot, Multiplier } from "../game/types";
import { dartValue, isDoubleFinish, isSlotComplete, turnTotal } from "../game/types";
import { canUseMultiplierControls, canUseSlotControls, getActiveSlotIndex } from "./dartInputOrder";

interface DartInputProps {
  slots: [DartSlot, DartSlot, DartSlot];
  remaining: number;
  onSetSegment: (index: number, segment: number) => void;
  onSetMultiplier: (index: number, multiplier: Multiplier) => void;
  onClearSlot: (index: number) => void;
  onConfirmTurn: () => void;
  onUndo: () => void;
  onAbort: () => void;
  canUndo: boolean;
  isEditing: boolean;
  onCancelEdit: () => void;
  canSwitchStartingPlayer: boolean;
  onSwitchStartingPlayer: () => void;
}

const NUMBERS = [
  1, 2, 3, 4, 5, 6,
  7, 8, 9, 10, 11, 12,
  13, 14, 15, 16, 17, 18,
  19, 20, 25, 0,
];

export const DartInput = ({
  slots,
  remaining,
  onSetSegment,
  onSetMultiplier,
  onClearSlot,
  onConfirmTurn,
  onUndo,
  onAbort,
  canUndo,
  isEditing,
  onCancelEdit,
  canSwitchStartingPlayer,
  onSwitchStartingPlayer,
}: DartInputProps) => {
  const activeSlot = getActiveSlotIndex(slots);
  const hasAnyDart = slots.some((s) => s.segment !== null);
  const completedDarts = slots.filter(isSlotComplete).map((s) => ({
    segment: s.segment,
    multiplier: s.multiplier,
  }));
  const runningTotal = turnTotal(completedDarts);

  // Live-Vorschau: nach welchem Slot (falls überhaupt) wäre das Leg mit den
  // bisher eingegebenen Darts beendet? Für die Double-Out-Prüfung zählt der
  // zuletzt tatsächlich AUSGEFÜLLTE Slot, unabhängig von seiner Position in
  // der Reihe - leere Slots dazwischen werden einfach übersprungen.
  let finishSlotIndex: number | null = null;
  {
    let runningSum = 0;
    let lastFilledIndex: number | null = null;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!isSlotComplete(slot)) continue;
      runningSum += dartValue({ segment: slot.segment, multiplier: slot.multiplier });
      lastFilledIndex = i;
      if (
        runningSum === remaining &&
        isDoubleFinish({ segment: slot.segment, multiplier: slot.multiplier })
      ) {
        finishSlotIndex = i;
      } else {
        finishSlotIndex = null;
      }
    }
    if (finishSlotIndex !== lastFilledIndex) finishSlotIndex = null;
  }

  const handleNumber = (segment: number) => {
    if (activeSlot === null) return;
    onSetSegment(activeSlot, segment);
  };

  return (
    <div className="dart-input">
      {isEditing && (
        <div className="dart-input__edit-banner">
          <span>Aufnahme wird korrigiert</span>
          <button onClick={onCancelEdit}>Abbrechen</button>
        </div>
      )}
      <div className="dart-input__summary">
        <div className="dart-input__summary-values">
          {[0, 1, 2].map((i) => {
            const slot = slots[i];
            const value = isSlotComplete(slot)
              ? dartValue({ segment: slot.segment, multiplier: slot.multiplier })
              : null;
            return (
              <span key={i} className="summary-value">
                {value === null ? "-" : value}
              </span>
            );
          })}
          <span className="summary-total">{runningTotal}</span>
          <span className="summary-remaining">{remaining - runningTotal}</span>
        </div>
        <div className="dart-input__summary-actions">
          <button className="summary-action-btn" onClick={onUndo} disabled={!canUndo || hasAnyDart}>
            Rückgängig
          </button>
          <button className="summary-action-btn" onClick={onAbort}>
            Spiel abbrechen
          </button>
        </div>
      </div>

      <div className="dart-columns">
        {[0, 1, 2].map((i) => (
          <DartColumn
            key={i}
            slot={slots[i]}
            isActive={activeSlot === i}
            isFinish={i === finishSlotIndex}
            canUseControls={canUseSlotControls(slots, i)}
            canUseMultipliers={canUseMultiplierControls(slots, i)}
            onSetMultiplier={(m) => {
              if (!canUseMultiplierControls(slots, i)) return;
              onSetMultiplier(i, m);
            }}
            onClear={() => onClearSlot(i)}
          />
        ))}
      </div>

      {canSwitchStartingPlayer && (
        <div className="dart-input__prestart">
          <button className="switch-btn" onClick={onSwitchStartingPlayer}>
            Startspieler wechseln
          </button>
        </div>
      )}

      <div className="dart-input__numbers">
        {NUMBERS.map((n) => (
          <button
            key={n}
            className={`num-btn ${n === 0 ? "num-btn--miss" : ""}`}
            onClick={() => handleNumber(n)}
          >
            {n}
          </button>
        ))}
        <button
          className="confirm-btn"
          onClick={onConfirmTurn}
          aria-label={isEditing ? "Korrektur übernehmen" : "Aufnahme bestätigen"}
          title={isEditing ? "Korrektur übernehmen" : "Aufnahme bestätigen"}
        >
          ✓
        </button>
      </div>
    </div>
  );
};

interface DartColumnProps {
  slot: DartSlot;
  isActive: boolean;
  isFinish: boolean;
  canUseControls: boolean;
  canUseMultipliers: boolean;
  onSetMultiplier: (m: Multiplier) => void;
  onClear: () => void;
}

const DartColumn = ({
  slot,
  isActive,
  isFinish,
  canUseControls,
  canUseMultipliers,
  onSetMultiplier,
  onClear,
}: DartColumnProps) => {
  const isBull = slot.segment === 25;
  const isMiss = slot.segment === 0;
  const canMultiply = !isMiss;
  const classes = [
    "dart-column",
    isActive ? "active" : "",
    isFinish ? "finish" : "",
    slot.segment !== null ? "filled" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <div className="dart-column__multipliers">
        {[2, 3, 4].map((m) => (
          <button
            key={m}
            className={`col-mult-btn ${slot.multiplier === m ? "selected" : ""}`}
            onClick={() => onSetMultiplier(m as Multiplier)}
            disabled={!canUseMultipliers || !canMultiply || (isBull && m > 2)}
          >
            x{m}
          </button>
        ))}
      </div>
      <button
        className={`dart-column__value ${slot.segment !== null ? "filled" : ""}`}
        onClick={() => {
          if (slot.segment !== null && canUseControls) onClear();
        }}
      >
        {formatSlot(slot)}
      </button>
    </div>
  );
};

const formatSlot = (slot: DartSlot): string => {
  if (slot.segment === null) return "-";
  if (slot.segment === 0) return "0";
  if (slot.segment === 25) return slot.multiplier === 2 ? "B50" : "B25";
  if (slot.multiplier === 1) return `${slot.segment}`;
  return `${slot.multiplier}x${slot.segment}`;
};
