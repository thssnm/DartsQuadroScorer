import { parseScoreDraft } from "../game/gameReducer";

interface ScoreInputProps {
  draft: string;
  remaining: number;
  shortcuts: number[];
  onDigit: (digit: number) => void;
  onBackspace: () => void;
  onShortcut: (score: number) => void;
  onConfirm: () => void;
  onUndo: () => void;
  onAbort: () => void;
  canUndo: boolean;
  isEditing: boolean;
  onCancelEdit: () => void;
  canSwitchStartingPlayer: boolean;
  onSwitchStartingPlayer: () => void;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Summeneingabe: Ziffernblock links, rechts die häufigsten Scores als
// Shortcuts. Ein Shortcut bestätigt die Aufnahme sofort.
export const ScoreInput = ({
  draft,
  remaining,
  shortcuts,
  onDigit,
  onBackspace,
  onShortcut,
  onConfirm,
  onUndo,
  onAbort,
  canUndo,
  isEditing,
  onCancelEdit,
  canSwitchStartingPlayer,
  onSwitchStartingPlayer,
}: ScoreInputProps) => {
  const score = parseScoreDraft(draft);
  const after = score === null ? null : remaining - score;
  // Vorschau wie im Dart-Modus: grün beim Checkout, rot wenn die Aufnahme
  // ein Bust wäre.
  const previewClass = after === 0 ? "checkout" : after !== null && (after < 0 || after === 1) ? "bust" : "";

  return (
    <div className="dart-input score-input">
      {isEditing && (
        <div className="dart-input__edit-banner">
          <span>Aufnahme wird korrigiert</span>
          <button onClick={onCancelEdit}>Abbrechen</button>
        </div>
      )}
      {canSwitchStartingPlayer && (
        <div className="dart-input__summary">
          <div className="dart-input__summary-switch">
            <button className="summary-switch-btn" onClick={onSwitchStartingPlayer}>
              Startspieler wechseln
            </button>
          </div>
        </div>
      )}

      <div className="score-input__head">
        <div className="score-input__totals" aria-label="Aufnahme und Restscore">
          {/* Geschütztes Leerzeichen hält die Zeilenhöhe, solange nichts getippt ist. */}
          <strong>{draft === "" ? " " : draft}</strong>
          <span className={previewClass}>{after === null ? remaining : after}</span>
        </div>
        <div className="dart-input__throw-action-buttons">
          <button className="summary-action-btn" onClick={onUndo} disabled={!canUndo}>
            Rückgängig
          </button>
          <button className="summary-action-btn" onClick={onAbort}>
            Spiel abbrechen
          </button>
        </div>
      </div>

      <div className="score-input__pad">
        <div className="score-input__numpad">
          {DIGITS.map((digit) => (
            <button key={digit} className="score-btn" onClick={() => onDigit(digit)}>
              {digit}
            </button>
          ))}
          <button
            className="score-btn score-btn--backspace"
            onClick={onBackspace}
            disabled={draft === ""}
            aria-label="Letzte Ziffer löschen"
            title="Letzte Ziffer löschen"
          >
            <svg viewBox="0 0 32 22" aria-hidden="true" focusable="false">
              <path d="M11 3h16a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H11L2 11z" />
              <path d="M20 7l-8 8m0-8 8 8" />
            </svg>
          </button>
          <button className="score-btn" onClick={() => onDigit(0)}>
            0
          </button>
          <button
            className="score-btn score-btn--confirm"
            onClick={onConfirm}
            disabled={score === null}
            aria-label={isEditing ? "Korrektur übernehmen" : "Aufnahme bestätigen"}
            title={isEditing ? "Korrektur übernehmen" : "Aufnahme bestätigen"}
          >
            ✓
          </button>
        </div>
        <div className="score-input__shortcuts" aria-label="Häufige Scores">
          {shortcuts.map((value) => (
            <button key={value} className="score-shortcut-btn" onClick={() => onShortcut(value)}>
              {value}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
