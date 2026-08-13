import type { DartSlot, Multiplier } from "../game/types";

interface DartInputProps {
  slots: [DartSlot, DartSlot, DartSlot];
  onSetSegment: (index: number, segment: number) => void;
  onSetMultiplier: (index: number, multiplier: Multiplier) => void;
  onClearSlot: (index: number) => void;
  onConfirmTurn: () => void;
  onBust: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

const NUMBERS = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20],
];

export const DartInput = ({
  slots,
  onSetSegment,
  onSetMultiplier,
  onClearSlot,
  onConfirmTurn,
  onBust,
  onUndo,
  canUndo,
}: DartInputProps) => {
  // Aktiver Slot: der erste, der noch keine Zahl hat. Zahlen-Taps landen
  // dort. Multiplikator-Taps wirken ebenfalls auf den aktiven Slot -
  // unabhängig davon, ob die Zahl schon gesetzt ist oder nicht.
  const activeIndex = slots.findIndex((s) => s.segment === null);
  const effectiveIndex = activeIndex === -1 ? null : activeIndex;

  const hasAnyDart = slots.some((s) => s.segment !== null);

  const handleNumber = (segment: number) => {
    if (effectiveIndex === null) return;
    onSetSegment(effectiveIndex, segment);
  };

  const handleMultiplierForActive = (m: Multiplier) => {
    if (effectiveIndex === null) return;
    onSetMultiplier(effectiveIndex, m);
  };

  return (
    <div className="dart-input">
      <div className="dart-columns">
        {[0, 1, 2].map((i) => (
          <DartColumn
            key={i}
            slot={slots[i]}
            isActive={i === effectiveIndex}
            onSetMultiplier={(m) => onSetMultiplier(i, m)}
            onClear={() => onClearSlot(i)}
          />
        ))}
      </div>

      <div className="dart-input__grid">
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
          <button
            className="num-btn bull-btn"
            onClick={() => handleNumber(25)}
            disabled={effectiveIndex === null}
          >
            25
          </button>
          <button
            className="num-btn miss-btn"
            onClick={() => handleNumber(0)}
            disabled={effectiveIndex === null}
          >
            0
          </button>
        </div>

        <div className="dart-input__modifiers">
          <button
            className="mod-btn"
            onClick={() => handleMultiplierForActive(2)}
            disabled={effectiveIndex === null}
          >
            x2
          </button>
          <button
            className="mod-btn"
            onClick={() => handleMultiplierForActive(3)}
            disabled={effectiveIndex === null}
          >
            x3
          </button>
          <button
            className="mod-btn"
            onClick={() => handleMultiplierForActive(4)}
            disabled={effectiveIndex === null}
          >
            x4
          </button>
          <button className="mod-btn undo-btn" onClick={onUndo} disabled={!canUndo || hasAnyDart}>
            Korrektur
          </button>
          <button className="mod-btn bust-btn" onClick={onBust} disabled={!hasAnyDart}>
            BUST
          </button>
          <button className="mod-btn confirm-btn" onClick={onConfirmTurn} disabled={!hasAnyDart}>
            ✓
          </button>
        </div>
      </div>
    </div>
  );
};

interface DartColumnProps {
  slot: DartSlot;
  isActive: boolean;
  onSetMultiplier: (m: Multiplier) => void;
  onClear: () => void;
}

const DartColumn = ({ slot, isActive, onSetMultiplier, onClear }: DartColumnProps) => {
  const isBull = slot.segment === 25;
  const isMiss = slot.segment === 0;
  const canMultiply = slot.segment !== null && !isMiss;

  return (
    <div className={`dart-column ${isActive ? "active" : ""}`}>
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
