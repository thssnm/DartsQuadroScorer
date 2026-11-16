import { useEffect, useState } from "react";

export interface Settings {
  boardId: string;
  resultUploadEnabled: boolean;
  liveScoreEnabled: boolean;
}

interface SettingsModalProps {
  boardId: string;
  resultUploadEnabled: boolean;
  liveScoreEnabled?: boolean;
  // Statuszeile des Livescore-Senders, null = noch nichts gesendet.
  liveScoreStatus?: string | null;
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
  resultUploadEnabled,
  liveScoreEnabled = false,
  liveScoreStatus = null,
  apiEmail,
  onApiLogin,
  onApiLogout,
  onApiTest,
  onSave,
  onClose,
}: SettingsModalProps) => {
  // Die Eingaben werden erst mit "Speichern" übernommen. Vorher lagen sie
  // bei jedem Tastendruck im localStorage - ein halb getippter Wert hätte
  // den Board-Namen mitten im Turnier verfälscht.
  const [draftBoardId, setDraftBoardId] = useState(boardId);
  const [draftUploadEnabled, setDraftUploadEnabled] = useState(resultUploadEnabled);
  const [draftLiveScoreEnabled, setDraftLiveScoreEnabled] = useState(liveScoreEnabled);
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
        {apiEmail === null ? (
          // Ohne Anmeldung gibt es nichts einzustellen: Upload, Spielerliste
          // und Livescore hängen alle am Token.
          <>
            <h3 className="settings-modal__section">Anmeldung</h3>
            <label className="settings-modal__field">
              <span>E-Mail</span>
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                autoComplete="username"
                autoFocus
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
            {apiStatus && <p className="settings-modal__status">{apiStatus}</p>}
          </>
        ) : (
          <>
            <p className="settings-modal__status">Angemeldet als {apiEmail}</p>
            <button type="button" className="settings-modal__test" onClick={handleApiTest} disabled={apiBusy}>
              {apiBusy ? "Verbindung wird getestet …" : "Verbindung testen"}
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
            {apiStatus && <p className="settings-modal__status">{apiStatus}</p>}
            <h3 className="settings-modal__section">Board</h3>
            <label className="settings-modal__field">
              <span>Board-Name</span>
              <input
                value={draftBoardId}
                onChange={(event) => setDraftBoardId(event.target.value)}
                placeholder="Board-Name eingeben"
              />
            </label>
            <label className="settings-modal__toggle">
              <input
                type="checkbox"
                checked={draftUploadEnabled}
                onChange={(event) => setDraftUploadEnabled(event.target.checked)}
              />
              <span>Ergebnis-Upload aktivieren</span>
            </label>
            <label className="settings-modal__toggle">
              <input
                type="checkbox"
                checked={draftLiveScoreEnabled}
                onChange={(event) => setDraftLiveScoreEnabled(event.target.checked)}
              />
              <span>Livescore senden</span>
            </label>
            {liveScoreStatus && <p className="settings-modal__status">{liveScoreStatus}</p>}
            <button type="button" className="settings-modal__save" onClick={handleSave}>
              Speichern
            </button>
          </>
        )}
      </div>
    </div>
  );
};
