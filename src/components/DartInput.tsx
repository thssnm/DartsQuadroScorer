import { useEffect, useState } from "react";
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
  isEditing: boolean;
  onCancelEdit: () => void;
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
  isEditing,
  onCancelEdit,
}: DartInputProps) => {
  // Welcher Slot ist gerade zur Eingabe ausgewählt. Jeder der 3 Slots ist
  // jederzeit direkt antippbar (Reihenfolge egal) - Klick auf eine Spalte
  // wählt sie aus, egal ob sie schon befüllt ist oder nicht. Zahlen- und
  // Multiplikator-Taps wirken danach auf den ausgewählten Slot.
  const [selectedSlot, setSelectedSlot] = useState<number>(0);

  const allEmpty = slots.every((s) => s.segment === null);

  // Sobald eine neue, komplett leere Aufnahme beginnt, springt der Fokus
  // zurück auf Slot 1 (links) - unabhängig davon, wo er zuvor stand.
  // Ansonsten springt er automatisch zum nächsten offenen Slot weiter,
  // sobald der aktuell ausgewählte befüllt wird (normales 1-2-3-Eingeben
  // spart sich damit einen Tap pro Dart).
  useEffect(() => {
    if (allEmpty) {
      setSelectedSlot(0);
      return;
    }
    if (slots[selectedSlot].segment !== null) {
      const nextOpen = slots.findIndex((s) => s.segment === null);
      if (nextOpen !== -1) setSelectedSlot(nextOpen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots[0].segment, slots[1].segment, slots[2].segment]);

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
    onSetSegment(selectedSlot, segment);
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
        <span className="summary-remaining">{remaining - runningTotal}</span>
        <button className="undo-inline-btn" onClick={onUndo} disabled={!canUndo || hasAnyDart}>
          RÜCKGÄNGIG
        </button>
      </div>

      <div className="dart-columns">
        {[0, 1, 2].map((i) => (
          <DartColumn
            key={i}
            slot={slots[i]}
            isActive={i === selectedSlot}
            isFinish={i === finishSlotIndex}
            onSelect={() => setSelectedSlot(i)}
            onSetMultiplier={(m) => {
              setSelectedSlot(i);
              onSetMultiplier(i, m);
            }}
            onClear={() => onClearSlot(i)}
          />
        ))}
      </div>

      <div className="dart-input__numbers">
        {NUMBERS.flat().map((n) => (
          <button key={n} className="num-btn" onClick={() => handleNumber(n)}>
            {n}
          </button>
        ))}
      </div>

      <button className="confirm-btn-wide" onClick={onConfirmTurn}>
        {isEditing ? "✓ Korrektur übernehmen" : "✓ Aufnahme bestätigen"}
      </button>
    </div>
  );
};

interface DartColumnProps {
  slot: DartSlot;
  isActive: boolean;
  isFinish: boolean;
  onSelect: () => void;
  onSetMultiplier: (m: Multiplier) => void;
  onClear: () => void;
}

const DartColumn = ({ slot, isActive, isFinish, onSelect, onSetMultiplier, onClear }: DartColumnProps) => {
  const isBull = slot.segment === 25;
  const isMiss = slot.segment === 0;
  const canMultiply = !isMiss;

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
      <button className={`dart-column__value ${slot.segment !== null ? "filled" : ""}`} onClick={onSelect}>
        {formatSlot(slot)}
      </button>
      {slot.segment !== null && (
        <button className="dart-column__clear" onClick={onClear}>
          ✕
        </button>
      )}
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
