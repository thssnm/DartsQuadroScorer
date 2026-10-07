import { useEffect, useState } from "react";
import type { MatchHistoryEntry } from "../game/persistence";

const HISTORY_STATUS_LABEL: Record<MatchHistoryEntry["uploadStatus"], string> = {
  uploaded: "Erfolgreich hochgeladen",
  "not-uploaded": "Nicht hochgeladen",
  "upload-disabled": "Nicht übertragen (Upload deaktiviert)",
};

interface MatchHistoryModalProps {
  entries: MatchHistoryEntry[];
  // Liefert true, wenn der nachträgliche Upload geklappt hat.
  onUpload: (entry: MatchHistoryEntry) => Promise<boolean>;
  onClose: () => void;
}

const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleString("de-DE");
};

const formatAverage = (average?: number): string =>
  average === undefined ? "-" : average.toFixed(1);

export const MatchHistoryModal = ({ entries, onUpload, onClose }: MatchHistoryModalProps) => {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

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
                  {HISTORY_STATUS_LABEL[entry.uploadStatus]}
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
