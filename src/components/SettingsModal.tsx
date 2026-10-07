import { useEffect, useState } from "react";

export interface Settings {
  boardId: string;
  gistId: string;
  resultUploadEnabled: boolean;
}

interface SettingsModalProps {
  boardId: string;
  gistId: string;
  resultUploadEnabled: boolean;
  onTestConnection: (gistId: string) => Promise<string>;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export const SettingsModal = ({
  boardId,
  gistId,
  resultUploadEnabled,
  onTestConnection,
  onSave,
  onClose,
}: SettingsModalProps) => {
  // Die Eingaben werden erst mit "Speichern" übernommen. Vorher lagen sie
  // bei jedem Tastendruck im localStorage - ein halb getippter Wert hätte
  // die Gist-Anbindung mitten im Turnier unbrauchbar gemacht.
  const [draftBoardId, setDraftBoardId] = useState(boardId);
  const [draftGistId, setDraftGistId] = useState(gistId);
  const [draftUploadEnabled, setDraftUploadEnabled] = useState(resultUploadEnabled);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleTestConnection = () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    // Getestet wird die gerade eingetippte Gist-ID, nicht die gespeicherte.
    void onTestConnection(draftGistId)
      .then(setConnectionStatus)
      .catch((error: unknown) =>
        setConnectionStatus(error instanceof Error ? error.message : "Verbindung fehlgeschlagen")
      )
      .finally(() => setTestingConnection(false));
  };

  const handleSave = () => {
    onSave({
      boardId: draftBoardId,
      gistId: draftGistId,
      resultUploadEnabled: draftUploadEnabled,
    });
    onClose();
  };

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
            value={draftBoardId}
            onChange={(event) => setDraftBoardId(event.target.value)}
            placeholder="Board-Name eingeben"
            autoFocus
          />
        </label>
        <label className="settings-modal__field">
          <span>Gist-ID</span>
          {/* Verdeckt, damit die ID am Board nicht abgelesen oder abfotografiert
              werden kann - sonst ließen sich von fremden Geräten Ergebnisse in
              denselben Gist schreiben. */}
          <input
            type="password"
            value={draftGistId}
            onChange={(event) => setDraftGistId(event.target.value)}
            placeholder="Gist-ID eingeben"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="settings-modal__test"
          onClick={handleTestConnection}
          disabled={testingConnection}
        >
          {testingConnection ? "Verbindung wird getestet …" : "Verbindung testen"}
        </button>
        {connectionStatus && <p className="settings-modal__status">{connectionStatus}</p>}
        <label className="settings-modal__toggle">
          <input
            type="checkbox"
            checked={draftUploadEnabled}
            onChange={(event) => setDraftUploadEnabled(event.target.checked)}
          />
          <span>Ergebnis-Upload aktivieren</span>
        </label>
        <button type="button" className="settings-modal__save" onClick={handleSave}>
          Speichern
        </button>
      </div>
    </div>
  );
};
