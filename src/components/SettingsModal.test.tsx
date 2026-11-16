import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SettingsModal } from "./SettingsModal";

const render = (overrides: Partial<Parameters<typeof SettingsModal>[0]> = {}): string =>
  renderToStaticMarkup(
    <SettingsModal
      boardId="Board 3"
      resultUploadEnabled
      apiEmail={null}
      onApiLogin={vi.fn().mockResolvedValue({ ok: true, message: "ok" })}
      onApiLogout={vi.fn()}
      onApiTest={vi.fn().mockResolvedValue("ok")}
      onSave={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />
  );

const inputs = (markup: string): string[] => [...markup.matchAll(/<input[^>]*>/g)].map((m) => m[0]);

describe("SettingsModal while logged out", () => {
  it("shows only the login with e-mail and password", () => {
    const markup = render();
    const [emailInput, passwordInput, ...rest] = inputs(markup);

    expect(emailInput).toContain('type="email"');
    expect(passwordInput).toContain('type="password"');
    expect(rest).toHaveLength(0);
    expect(markup).toContain("Anmelden");
    expect(markup).not.toContain("Abmelden");
  });

  it("hides board name, upload switch, livescore and save until logged in", () => {
    const markup = render();

    expect(markup).not.toContain("Board-Name");
    expect(markup).not.toContain("Ergebnis-Upload aktivieren");
    expect(markup).not.toContain("Livescore senden");
    expect(markup).not.toContain("Speichern");
    expect(markup).not.toContain("Gist");
  });
});

describe("SettingsModal while logged in", () => {
  const loggedIn = (overrides: Partial<Parameters<typeof SettingsModal>[0]> = {}) =>
    render({ apiEmail: "board@example.com", ...overrides });

  it("shows the user with logout and connection test instead of the login form", () => {
    const markup = loggedIn();

    expect(markup).toContain("Angemeldet als board@example.com");
    expect(markup).toContain("Abmelden");
    expect(markup).toContain("Verbindung testen");
    expect(markup).not.toContain('type="email"');
  });

  it("prefills board name and switches from the stored settings", () => {
    const markup = loggedIn({ boardId: "Board 7", resultUploadEnabled: false, liveScoreEnabled: true });
    const [boardInput, uploadToggle, liveToggle] = inputs(markup);

    expect(boardInput).toContain('value="Board 7"');
    expect(boardInput).not.toContain('type="password"');
    expect(uploadToggle).toContain("checkbox");
    expect(uploadToggle).not.toContain("checked");
    expect(liveToggle).toContain("checked");
    expect(liveToggle).not.toContain("disabled");
    expect(markup).toContain("Speichern");
  });

  it("shows the livescore sender status line", () => {
    const markup = loggedIn({ liveScoreEnabled: true, liveScoreStatus: "Zuletzt gesendet: 19:05:07" });

    expect(markup).toContain("Livescore senden");
    expect(markup).toContain("Zuletzt gesendet: 19:05:07");
  });
});
