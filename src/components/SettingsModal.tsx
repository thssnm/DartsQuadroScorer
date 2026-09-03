import { useEffect } from "react";

interface SettingsModalProps {
  boardId: string;
  gistId: string;
  resultUploadEnabled: boolean;
  onBoardIdChange: (boardId: string) => void;
  onGistIdChange: (gistId: string) => void;
  onResultUploadEnabledChange: (enabled: boolean) => void;
  onClose: () => void;
}

export const SettingsModal = ({
  boardId,
  gistId,
  resultUploadEnabled,
  onBoardIdChange,
  onGistIdChange,
  onResultUploadEnabledChange,
  onClose,
}: SettingsModalProps) => {
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
        <label className="settings-modal__field">
          <span>Gist-ID</span>
          <input
            value={gistId}
            onChange={(event) => onGistIdChange(event.target.value)}
            placeholder="Gist-ID eingeben"
            autoComplete="off"
          />
        </label>
        <label className="settings-modal__toggle">
          <input
            type="checkbox"
            checked={resultUploadEnabled}
            onChange={(event) => onResultUploadEnabledChange(event.target.checked)}
          />
          <span>Ergebnis-Upload aktivieren</span>
        </label>
      </div>
    </div>
  );
};
