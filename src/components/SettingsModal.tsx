import { useEffect, useState } from "react";

export interface Settings {
  boardId: string;
  gistId: string;
  resultUploadEnabled: boolean;
  liveScoreEnabled: boolean;
}

interface SettingsModalProps {
  boardId: string;
  gistId: string;
  resultUploadEnabled: boolean;
  liveScoreEnabled?: boolean;
  // Statuszeile des Livescore-Senders, null = noch nichts gesendet.
  liveScoreStatus?: string | null;
  onTestConnection: (gistId: string) => Promise<string>;
  // E-Mail der API-Anmeldung, null = nicht angemeldet.
  apiEmail: string | null;
  // Liefert die Meldung für den Nutzer; ok = Anmeldung gespeichert.
  onApiLogin: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  onApiLogout: () => void;
  onApiTest: () => Promise<string>;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export const SettingsModal = ({
  boardId,
  gistId,
  resultUploadEnabled,
  liveScoreEnabled = false,
  liveScoreStatus = null,
  onTestConnection,
  apiEmail,
  onApiLogin,
  onApiLogout,
  onApiTest,
  onSave,
  onClose,
}: SettingsModalProps) => {
  // Die Eingaben werden erst mit "Speichern" übernommen. Vorher lagen sie
  // bei jedem Tastendruck im localStorage - ein halb getippter Wert hätte
  // die Gist-Anbindung mitten im Turnier unbrauchbar gemacht.
  const [draftBoardId, setDraftBoardId] = useState(boardId);
  const [draftGistId, setDraftGistId] = useState(gistId);
  const [draftUploadEnabled, setDraftUploadEnabled] = useState(resultUploadEnabled);
  const [draftLiveScoreEnabled, setDraftLiveScoreEnabled] = useState(liveScoreEnabled);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [loginEmail, setLoginEmail] = useState(apiEmail ?? "");
  const [loginPassword, setLoginPassword] = useState("");
  const [apiStatus, setApiStatus] = useState<string | null>(null);
  const [apiBusy, setApiBusy] = useState(false);

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

  // Die Anmeldung wirkt sofort, unabhängig von "Speichern".
  const handleApiLogin = () => {
    setApiBusy(true);
    setApiStatus(null);
    void onApiLogin(loginEmail, loginPassword)
      .then((result) => {
        setApiStatus(result.ok ? null : result.message);
        // Das Passwort bleibt nicht einmal im Formular stehen.
        if (result.ok) setLoginPassword("");
      })
      .finally(() => setApiBusy(false));
  };

  const handleApiTest = () => {
    setApiBusy(true);
    setApiStatus(null);
    void onApiTest()
      .then(setApiStatus)
      .catch((error: unknown) =>
        setApiStatus(error instanceof Error ? error.message : "Verbindung fehlgeschlagen")
      )
      .finally(() => setApiBusy(false));
  };

  const handleSave = () => {
    onSave({
      boardId: draftBoardId,
      gistId: draftGistId,
      resultUploadEnabled: draftUploadEnabled,
      liveScoreEnabled: draftLiveScoreEnabled,
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
        <h3 className="settings-modal__section">API</h3>
        {apiEmail !== null ? (
          <>
            <p className="settings-modal__status">Angemeldet als {apiEmail}</p>
            <button type="button" className="settings-modal__test" onClick={handleApiTest} disabled={apiBusy}>
              {apiBusy ? "Verbindung wird getestet …" : "API-Verbindung testen"}
            </button>
            <button
              type="button"
              className="settings-modal__test"
              onClick={() => {
                setApiStatus(null);
                onApiLogout();
              }}
              disabled={apiBusy}
            >
              Abmelden
            </button>
          </>
        ) : (
          <>
            <label className="settings-modal__field">
              <span>E-Mail</span>
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="settings-modal__field">
              <span>Passwort</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button
              type="button"
              className="settings-modal__test"
              onClick={handleApiLogin}
              disabled={apiBusy || !loginEmail.trim() || !loginPassword}
            >
              {apiBusy ? "Anmeldung läuft …" : "Anmelden"}
            </button>
          </>
        )}
        {apiStatus && <p className="settings-modal__status">{apiStatus}</p>}
        <label className="settings-modal__toggle">
          <input
            type="checkbox"
            checked={draftLiveScoreEnabled}
            onChange={(event) => setDraftLiveScoreEnabled(event.target.checked)}
            disabled={apiEmail === null}
          />
          <span>Livescore senden</span>
        </label>
        {apiEmail === null ? (
          <p className="settings-modal__status">Zuerst bei der API anmelden</p>
        ) : (
          liveScoreStatus && <p className="settings-modal__status">{liveScoreStatus}</p>
        )}
        <button type="button" className="settings-modal__save" onClick={handleSave}>
          Speichern
        </button>
      </div>
    </div>
  );
};
