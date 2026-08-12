import { useState } from "react";
import type { Dart, Multiplier } from "../game/types";

interface DartInputProps {
  dartsThisTurn: Dart[];
  onAddDart: (dart: Dart) => void;
  onRemoveLast: () => void;
  onConfirmTurn: () => void;
  onBust: () => void;
  disabled: boolean;
}

const NUMBERS = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20],
];

export const DartInput = ({
  dartsThisTurn,
  onAddDart,
  onRemoveLast,
  onConfirmTurn,
  onBust,
  disabled,
}: DartInputProps) => {
  const [activeMultiplier, setActiveMultiplier] = useState<Multiplier>(1);

  const canAddDart = dartsThisTurn.length < 3 && !disabled;

  const handleNumber = (segment: number) => {
    if (!canAddDart) return;
    onAddDart({ segment, multiplier: activeMultiplier });
    setActiveMultiplier(1);
  };

  const handleBull = () => {
    if (!canAddDart) return;
    // 25 direkt, x2 aktiv -> 50 (Bull-Extra). x3/x4 auf Bull nicht möglich.
    const mult: Multiplier = activeMultiplier === 2 ? 2 : 1;
    onAddDart({ segment: 25, multiplier: mult });
    setActiveMultiplier(1);
  };

  const handleMiss = () => {
    if (!canAddDart) return;
    onAddDart({ segment: 0, multiplier: 1 });
    setActiveMultiplier(1);
  };

  const toggleMultiplier = (m: Multiplier) => {
    setActiveMultiplier((prev) => (prev === m ? 1 : m));
  };

  return (
    <div className="dart-input">
      <div className="dart-input__preview">
        {[0, 1, 2].map((i) => {
          const dart = dartsThisTurn[i];
          return (
            <div key={i} className={`dart-slot ${dart ? "filled" : ""}`}>
              {dart ? formatDart(dart) : "-"}
            </div>
          );
        })}
      </div>

      <div className="dart-input__grid">
        <div className="dart-input__numbers">
          {NUMBERS.flat().map((n) => (
            <button
              key={n}
              className={`num-btn ${activeMultiplier > 1 ? `mult-${activeMultiplier}` : ""}`}
              onClick={() => handleNumber(n)}
              disabled={!canAddDart}
            >
              {n}
            </button>
          ))}
          <button
            className={`num-btn bull-btn ${activeMultiplier === 2 ? "mult-2" : ""}`}
            onClick={handleBull}
            disabled={!canAddDart}
          >
            25
          </button>
          <button className="num-btn miss-btn" onClick={handleMiss} disabled={!canAddDart}>
            0
          </button>
        </div>

        <div className="dart-input__modifiers">
          <button
            className={`mod-btn ${activeMultiplier === 2 ? "active" : ""}`}
            onClick={() => toggleMultiplier(2)}
            disabled={!canAddDart}
          >
            x2
          </button>
          <button
            className={`mod-btn ${activeMultiplier === 3 ? "active" : ""}`}
            onClick={() => toggleMultiplier(3)}
            disabled={!canAddDart}
          >
            x3
          </button>
          <button
            className={`mod-btn ${activeMultiplier === 4 ? "active" : ""}`}
            onClick={() => toggleMultiplier(4)}
            disabled={!canAddDart}
          >
            x4
          </button>
          <button className="mod-btn bust-btn" onClick={onBust} disabled={disabled}>
            BUST
          </button>
          <button
            className="mod-btn remove-btn"
            onClick={onRemoveLast}
            disabled={dartsThisTurn.length === 0}
          >
            ⌫
          </button>
          <button
            className="mod-btn confirm-btn"
            onClick={onConfirmTurn}
            disabled={dartsThisTurn.length === 0 || disabled}
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  );
};

const formatDart = (dart: Dart): string => {
  if (dart.segment === 0) return "0";
  if (dart.segment === 25) return dart.multiplier === 2 ? "B50" : "B25";
  if (dart.multiplier === 1) return `${dart.segment}`;
  return `${dart.multiplier}x${dart.segment}`;
};
