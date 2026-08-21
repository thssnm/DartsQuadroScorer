import type { DartSlot, Multiplier } from "../game/types";
import { dartValue, isDoubleFinish, isSlotComplete, turnTotal } from "../game/types";

interface DartInputProps {
  slots: [DartSlot, DartSlot, DartSlot];
  remaining: number;
  onSetSegment: (index: number, segment: number) => void;
  onSetMultiplier: (index: number, multiplier: Multiplier) => void;
  onClearSlot: (index: number) => void;
  onConfirmTurn: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

const NUMBERS = [
  [1, 2, 3, 4, 5, 6, 7],
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 25],
];

export const DartInput = ({
  slots,
  remaining,
  onSetSegment,
  onSetMultiplier,
  onClearSlot,
  onConfirmTurn,
  onUndo,
  canUndo,
}: DartInputProps) => {
  // Aktiver Slot: der erste, der noch keine Zahl hat. Zahlen-Taps landen
  // dort. Multiplikator-Taps wirken ebenfalls auf den aktiven Slot -
  // unabhängig davon, ob die Zahl schon gesetzt ist oder nicht.
  const activeIndex = slots.findIndex((s) => s.segment === null);
  const effectiveIndex = activeIndex === -1 ? null : activeIndex;

  const hasAnyDart = slots.some((s) => s.segment !== null);
  const completedDarts = slots.filter(isSlotComplete).map((s) => ({
    segment: s.segment,
    multiplier: s.multiplier,
  }));
  const runningTotal = turnTotal(completedDarts);

  // Live-Vorschau: nach welchem Slot (falls überhaupt) wäre das Leg mit den
  // bisher eingegebenen Darts beendet? Nur der letzte tatsächlich gesetzte
  // Dart zählt für die Double-Out-Prüfung - Slots davor werden ignoriert,
  // falls dazwischen noch ein leerer Slot liegt (Reihenfolge egal).
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
    // Nur relevant, wenn der Finish-Dart auch der zuletzt gesetzte ist.
    if (finishSlotIndex !== lastFilledIndex) finishSlotIndex = null;
  }

  const handleNumber = (segment: number) => {
    if (effectiveIndex === null) return;
    onSetSegment(effectiveIndex, segment);
  };

  return (
    <div className="dart-input">
      <div className="dart-input__summary">
        {[0, 1, 2].map((i) => {
          const slot = slots[i];
          const value = isSlotComplete(slot) ? dartValue({ segment: slot.segment, multiplier: slot.multiplier }) : null;
          return (
            <span key={i} className="summary-value">
              {value === null ? "-" : value}
            </span>
          );
        })}
        <span className="summary-total">{runningTotal}</span>
        <button className="undo-inline-btn" onClick={onUndo} disabled={!canUndo || hasAnyDart}>
          RÜCKGÄNGIG
        </button>
      </div>

      <div className="dart-columns">
        {[0, 1, 2].map((i) => (
          <DartColumn
            key={i}
            slot={slots[i]}
            isActive={i === effectiveIndex}
            isFinish={i === finishSlotIndex}
            onSetMultiplier={(m) => onSetMultiplier(i, m)}
            onClear={() => onClearSlot(i)}
          />
        ))}
      </div>

      <div className="dart-input__numbers">
        {NUMBERS.flat().map((n) => (
          <button
            key={n}
            className="num-btn"
            onClick={() => handleNumber(n)}
            disabled={effectiveIndex === null}
          >
            {n}
          </button>
        ))}
      </div>

      <button className="confirm-btn-wide" onClick={onConfirmTurn}>
        ✓ Aufnahme bestätigen
      </button>
    </div>
  );
};

interface DartColumnProps {
  slot: DartSlot;
  isActive: boolean;
  isFinish: boolean;
  onSetMultiplier: (m: Multiplier) => void;
  onClear: () => void;
}

const DartColumn = ({ slot, isActive, isFinish, onSetMultiplier, onClear }: DartColumnProps) => {
  const isBull = slot.segment === 25;
  const isMiss = slot.segment === 0;
  // Multiplikator ist klickbar, wenn der Slot der aktuell aktive (offene)
  // Slot ist - auch BEVOR eine Zahl gesetzt wurde (Multiplikator zuerst,
  // Zahl danach) - oder wenn bereits eine Zahl gesetzt ist (nachträgliche
  // Korrektur). Nur bei Miss (0) bleibt der Multiplikator gesperrt.
  const canMultiply = !isMiss && (isActive || slot.segment !== null);

  return (
    <div className={`dart-column ${isActive ? "active" : ""} ${isFinish ? "finish" : ""}`}>
      <div className="dart-column__multipliers">
        {[2, 3, 4].map((m) => (
          <button
            key={m}
            className={`col-mult-btn ${slot.multiplier === m ? "selected" : ""}`}
            onClick={() => onSetMultiplier(m as Multiplier)}
            disabled={!canMultiply || (isBull && m > 2)}
          >
            x{m}
          </button>
        ))}
      </div>
      <button className="dart-column__value" onClick={onClear} disabled={slot.segment === null}>
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
