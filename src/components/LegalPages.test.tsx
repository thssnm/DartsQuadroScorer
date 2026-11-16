import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LegalFooter, LegalModal } from "./LegalPages";
import { LEGAL_CONTACT } from "./legalContact";

describe("LegalPages", () => {
  it("offers links to imprint and privacy policy", () => {
    const markup = renderToStaticMarkup(<LegalFooter onOpen={vi.fn()} />);

    expect(markup).toContain(">Impressum</button>");
    expect(markup).toContain(">Datenschutz</button>");
  });

  it("shows name, address and e-mail in the imprint", () => {
    const markup = renderToStaticMarkup(<LegalModal page="impressum" onClose={vi.fn()} />);

    expect(markup).toContain("§ 5 DDG");
    expect(markup).toContain(LEGAL_CONTACT.name);
    expect(markup).toContain(LEGAL_CONTACT.street);
    expect(markup).toContain(LEGAL_CONTACT.city);
    expect(markup).toContain(LEGAL_CONTACT.email);
  });

  it("names the controller and the hosting, but not the hidden API features", () => {
    const markup = renderToStaticMarkup(<LegalModal page="datenschutz" onClose={vi.fn()} />);

    expect(markup).toContain(LEGAL_CONTACT.name);
    expect(markup).toContain("Vercel");
    expect(markup).not.toContain("Livescore");
    expect(markup).not.toContain("Anmeldung");
    expect(markup).toContain("localStorage");
    expect(markup).toContain("lovefordarts.de");
    // Klickzählung des Partner-Links.
    expect(markup).toContain("UTM-Parameter");
    expect(markup).toContain("api.thssn.dev");
  });
});
