import { useEffect, useState } from "react";
import type { MatchHistoryApiStatus, MatchHistoryEntry } from "../game/persistence";

const HISTORY_STATUS_LABEL: Record<MatchHistoryEntry["uploadStatus"], string> = {
  uploaded: "Erfolgreich hochgeladen",
  "not-uploaded": "Nicht hochgeladen",
  "upload-disabled": "Nicht übertragen (Upload deaktiviert)",
};

const API_STATUS_LABEL: Record<MatchHistoryApiStatus, string> = {
  uploaded: "Erfolgreich hochgeladen",
  "not-uploaded": "Nicht hochgeladen",
  "not-logged-in": "Nicht angemeldet",
  "upload-disabled": "Nicht übertragen (Upload deaktiviert)",
};

// Einträge aus der Zeit vor dem API-Ziel haben keinen API-Status.
const apiStatusOf = (entry: MatchHistoryEntry): MatchHistoryApiStatus =>
  entry.apiUploadStatus ?? "not-uploaded";

interface MatchHistoryModalProps {
  entries: MatchHistoryEntry[];
  // Liefert true, wenn der nachträgliche Upload geklappt hat.
  onUpload: (entry: MatchHistoryEntry) => Promise<boolean>;
  onApiUpload?: (entry: MatchHistoryEntry) => Promise<boolean>;
  apiLoggedIn?: boolean;
  onClose: () => void;
}

const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleString("de-DE");
};

const formatAverage = (average?: number): string =>
  average === undefined ? "-" : average.toFixed(1);

export const MatchHistoryModal = ({
  entries,
  onUpload,
  onApiUpload,
  apiLoggedIn = false,
  onClose,
}: MatchHistoryModalProps) => {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [apiUploadingId, setApiUploadingId] = useState<string | null>(null);
  const [apiErrorId, setApiErrorId] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleUpload = (entry: MatchHistoryEntry) => {
    setUploadingId(entry.id);
    setErrorId(null);
    void onUpload(entry)
      .then((uploaded) => {
        if (!uploaded) setErrorId(entry.id);
      })
      .finally(() => setUploadingId(null));
  };

  const handleApiUpload = (entry: MatchHistoryEntry) => {
    if (!onApiUpload) return;
    setApiUploadingId(entry.id);
    setApiErrorId(null);
    void onApiUpload(entry)
      .then((uploaded) => {
        if (!uploaded) setApiErrorId(entry.id);
      })
      .finally(() => setApiUploadingId(null));
  };

  return (
    <div className="settings-modal" onMouseDown={onClose} role="presentation">
      <div
        className="settings-modal__panel match-history"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-history-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="settings-modal__header">
          <h2 id="match-history-title">Match-Historie</h2>
          <button type="button" className="settings-modal__close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>

        {entries.length === 0 && <p className="match-history__empty">Noch kein Match beendet.</p>}

        <ul className="match-history__list">
          {entries.map((entry) => (
            <li key={entry.id} className="match-history__entry">
              <div className="match-history__head">
                <strong>
                  {entry.home} {entry.legsHome} : {entry.legsGuest} {entry.guest}
                </strong>
                <span className="match-history__date">{formatDate(entry.updatedAt)}</span>
              </div>
              <p className="match-history__meta">
                {entry.boardName} · Ø {formatAverage(entry.averageHome)} :{" "}
                {formatAverage(entry.averageGuest)}
              </p>
              {entry.highlights.length > 0 && (
                <p className="match-history__meta">{entry.highlights.join(", ")}</p>
              )}
              <div className="match-history__status-row">
                <span className={`match-history__status match-history__status--${entry.uploadStatus}`}>
                  Gist: {HISTORY_STATUS_LABEL[entry.uploadStatus]}
                </span>
                {/* Nur bei einem Eintrag, der nicht im Gist liegt - ein
                    bereits hochgeladenes Ergebnis darf nicht doppelt
                    geschrieben werden. */}
                {entry.uploadStatus !== "uploaded" && (
                  <button
                    type="button"
                    className="match-history__upload"
                    onClick={() => handleUpload(entry)}
                    disabled={uploadingId === entry.id}
                  >
                    {uploadingId === entry.id ? "Upload läuft …" : "Upload"}
                  </button>
                )}
              </div>
              {errorId === entry.id && (
                <p className="match-history__error">
                  Upload fehlgeschlagen. Verbindung und Einstellungen prüfen.
                </p>
              )}
              <div className="match-history__status-row">
                <span className={`match-history__status match-history__status--${apiStatusOf(entry)}`}>
                  API: {API_STATUS_LABEL[apiStatusOf(entry)]}
                </span>
                {/* Mehrfaches Klicken ist ungefährlich: die matchId ist in
                    der API eindeutig. */}
                {apiStatusOf(entry) !== "uploaded" && (
                  <button
                    type="button"
                    className="match-history__api-upload"
                    onClick={() => handleApiUpload(entry)}
                    disabled={!apiLoggedIn || apiUploadingId === entry.id}
                    title={apiLoggedIn ? undefined : "In den Einstellungen anmelden"}
                  >
                    {apiUploadingId === entry.id ? "Upload läuft …" : "Upload zur API"}
                  </button>
                )}
              </div>
              {!apiLoggedIn && apiStatusOf(entry) !== "uploaded" && (
                <p className="match-history__meta">In den Einstellungen anmelden</p>
              )}
              {apiErrorId === entry.id && (
                <p className="match-history__error">
                  Upload zur API fehlgeschlagen. Verbindung und Anmeldung prüfen.
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
