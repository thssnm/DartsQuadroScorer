import type { CheckoutDarts } from "../game/gameReducer";

export const CHECKOUT_PROMPT_TITLE = "Leg gecheckt!";

interface CheckoutDartsPromptProps {
  onChoose: (dartsUsed: CheckoutDarts) => void;
  onCancel: () => void;
}

// Bei Summeneingabe weiß die App nicht, mit dem wievielten Dart gecheckt
// wurde - davon hängen Average und Best Leg ab.
export const CheckoutDartsPrompt = ({ onChoose, onCancel }: CheckoutDartsPromptProps) => (
  <div className="leg-overlay">
    <div className="leg-overlay__card">
      <h1>{CHECKOUT_PROMPT_TITLE}</h1>
      <p>Mit wie vielen Darts?</p>
      <div className="leg-overlay__actions checkout-prompt__choices">
        {([1, 2, 3] as const).map((darts) => (
          <button key={darts} onClick={() => onChoose(darts)}>
            {darts} {darts === 1 ? "Dart" : "Darts"}
          </button>
        ))}
      </div>
      <div className="leg-overlay__actions">
        <button className="leg-overlay__secondary" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  </div>
);
