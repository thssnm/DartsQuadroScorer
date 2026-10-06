export const UNDO_RESULT_LABEL = "Rückgängig";

interface ResultOverlayProps {
  title: string;
  summary: string;
  confirmLabel: string;
  onConfirm: () => void;
  onUndo: () => void;
}

// Popup am Leg- bzw. Match-Ende. Neben dem Weiter-Button gibt es
// "Rückgängig" für den Fall, dass die entscheidende Aufnahme vertippt war:
// der Leg-Abschluss wird komplett zurückgenommen, danach lässt sich die
// Aufnahme wie gewohnt über die Score-Liste korrigieren.
export const ResultOverlay = ({
  title,
  summary,
  confirmLabel,
  onConfirm,
  onUndo,
}: ResultOverlayProps) => (
  <div className="leg-overlay">
    <div className="leg-overlay__card">
      <h1>{title}</h1>
      <p>{summary}</p>
      <div className="leg-overlay__actions">
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="leg-overlay__undo" onClick={onUndo}>
          {UNDO_RESULT_LABEL}
        </button>
      </div>
    </div>
  </div>
);
