import { useEffect, type ReactNode } from "react";
import { LEGAL_CONTACT } from "./legalContact";

export type LegalPage = "impressum" | "datenschutz";

interface LegalModalProps {
  page: LegalPage;
  onClose: () => void;
}

const Address = () => (
  <p>
    {LEGAL_CONTACT.name}
    <br />
    {LEGAL_CONTACT.street}
    <br />
    {LEGAL_CONTACT.city}
    <br />
    E-Mail: {LEGAL_CONTACT.email}
  </p>
);

const Impressum = () => (
  <>
    <h3>Angaben gemäß § 5 DDG</h3>
    <Address />
    <h3>Verantwortlich für den Inhalt</h3>
    <p>{LEGAL_CONTACT.name}, Anschrift wie oben.</p>
  </>
);

const Datenschutz = () => (
  <>
    <h3>Verantwortlicher</h3>
    <Address />

    <h3>Hosting</h3>
    <p>
      Die App wird bei Vercel Inc. (USA) gehostet. Beim Aufruf verarbeitet Vercel technisch notwendige Daten wie
      IP-Adresse, Zeitpunkt und abgerufene Datei in Server-Logs, um die App auszuliefern und den Betrieb abzusichern.
      Rechtsgrundlage ist das berechtigte Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Die
      Übermittlung in die USA erfolgt auf Grundlage des EU-US Data Privacy Framework bzw. der
      EU-Standardvertragsklauseln.
    </p>

    <h3>Speicherung im Browser</h3>
    <p>
      Spielstand, Einstellungen, zuletzt verwendete Spielernamen und die Match-Historie werden im lokalen Speicher
      des Geräts abgelegt (localStorage). Diese Daten verlassen das Gerät nicht und sind für die Funktion der App
      erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Es werden keine Cookies und kein Tracking eingesetzt.
    </p>

    <h3>Externe Links</h3>
    <p>
      Der Partner-Link führt zu lovefordarts.de. Daten werden erst beim Anklicken an den dortigen Anbieter
      übertragen; es gilt dessen Datenschutzerklärung.
    </p>

    <h3>Ihre Rechte</h3>
    <p>
      Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
      Datenübertragbarkeit und Widerspruch gegen eine Verarbeitung auf Grundlage berechtigter Interessen. Wenden Sie
      sich dafür an die oben genannte Adresse. Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde
      beschweren, etwa beim Landesbeauftragten für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz.
    </p>
  </>
);

const TITLES: Record<LegalPage, string> = { impressum: "Impressum", datenschutz: "Datenschutz" };
const CONTENT: Record<LegalPage, () => ReactNode> = { impressum: Impressum, datenschutz: Datenschutz };

export const LegalModal = ({ page, onClose }: LegalModalProps) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const Content = CONTENT[page];
  return (
    <div className="settings-modal" onMouseDown={onClose} role="presentation">
      <div
        className="settings-modal__panel legal-page"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="settings-modal__header">
          <h2 id="legal-title">{TITLES[page]}</h2>
          <button type="button" className="settings-modal__close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
        <Content />
      </div>
    </div>
  );
};

// Fußzeile der Startseite - immer sichtbar, unabhängig von ?settings.
export const LegalFooter = ({ onOpen }: { onOpen: (page: LegalPage) => void }) => (
  <nav className="legal-footer" aria-label="Rechtliches">
    <button type="button" onClick={() => onOpen("impressum")}>
      Impressum
    </button>
    <button type="button" onClick={() => onOpen("datenschutz")}>
      Datenschutz
    </button>
  </nav>
);
