import { useEffect } from "react";

interface SettingsModalProps {
  boardId: string;
  onBoardIdChange: (boardId: string) => void;
  onClose: () => void;
}

export const SettingsModal = ({ boardId, onBoardIdChange, onClose }: SettingsModalProps) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="settings-modal" onMouseDown={onClose} role="presentation">
      <div
        className="settings-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="settings-modal__header">
          <h2 id="settings-title">Einstellungen</h2>
          <button type="button" className="settings-modal__close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
        <label className="settings-modal__field">
          <span>Board-Name</span>
          <input
            value={boardId}
            onChange={(event) => onBoardIdChange(event.target.value)}
            placeholder="Board-Name eingeben"
            autoFocus
          />
        </label>
      </div>
    </div>
  );
};
