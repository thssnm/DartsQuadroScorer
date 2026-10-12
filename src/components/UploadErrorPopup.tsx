import type { UploadTarget } from "../api/uploadTargets";

export const UPLOAD_ERROR_MESSAGE =
  "Upload fehlgeschlagen. Bitte das Ergebnis der Turnierleitung melden.";

export const API_UPLOAD_ERROR_MESSAGE =
  "Upload zur API fehlgeschlagen. Der Gist-Upload war erfolgreich.";

// Sobald der Gist betroffen ist, gilt der bisherige Text samt Hinweis an die
// Turnierleitung - das Dashboard liest nur den Gist.
const uploadErrorMessage = (failedTargets: UploadTarget[]): string =>
  failedTargets.includes("gist") ? UPLOAD_ERROR_MESSAGE : API_UPLOAD_ERROR_MESSAGE;

export const UPLOAD_RETRY_LABEL = "Upload erneut versuchen";

interface UploadErrorPopupProps {
  onRetry: () => void;
  onConfirm: () => void;
  retrying: boolean;
  detail?: string | null;
  failedTargets?: UploadTarget[];
}

export const UploadErrorPopup = ({
  onRetry,
  onConfirm,
  retrying,
  detail,
  failedTargets = ["gist"],
}: UploadErrorPopupProps) => (
  <div className="leg-overlay">
    <div className="leg-overlay__card">
      <h1>Upload fehlgeschlagen</h1>
      <p>{uploadErrorMessage(failedTargets)}</p>
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
