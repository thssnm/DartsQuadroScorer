export const UPLOAD_ERROR_MESSAGE =
  "Upload fehlgeschlagen. Bitte das Ergebnis der Turnierleitung melden.";

export const UPLOAD_RETRY_LABEL = "Upload erneut versuchen";

interface UploadErrorPopupProps {
  onRetry: () => void;
  onConfirm: () => void;
  retrying: boolean;
  detail?: string | null;
}

export const UploadErrorPopup = ({ onRetry, onConfirm, retrying, detail }: UploadErrorPopupProps) => (
  <div className="leg-overlay">
    <div className="leg-overlay__card">
      <h1>Upload fehlgeschlagen</h1>
      <p>{UPLOAD_ERROR_MESSAGE}</p>
      {/* Kleingedruckte Fehlerursache - für den normalen Ablauf irrelevant,
          hilft aber bei der Nachbereitung eines Turniers. */}
      {detail && <p className="leg-overlay__detail">{detail}</p>}
      <div className="leg-overlay__actions">
        <button onClick={onRetry} disabled={retrying}>
          {retrying ? "Upload läuft …" : UPLOAD_RETRY_LABEL}
        </button>
        <button className="leg-overlay__secondary" onClick={onConfirm} disabled={retrying}>
          Verstanden
        </button>
      </div>
    </div>
  </div>
);
