export const UPLOAD_ERROR_MESSAGE =
  "Upload fehlgeschlagen. Bitte das Ergebnis der Turnierleitung melden.";

interface UploadErrorPopupProps {
  onConfirm: () => void;
}

export const UploadErrorPopup = ({ onConfirm }: UploadErrorPopupProps) => (
  <div className="leg-overlay">
    <div className="leg-overlay__card">
      <h1>Upload fehlgeschlagen</h1>
      <p>{UPLOAD_ERROR_MESSAGE}</p>
      <button onClick={onConfirm}>Verstanden</button>
    </div>
  </div>
);
