import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SettingsModal } from "./SettingsModal";

const render = (overrides: Partial<Parameters<typeof SettingsModal>[0]> = {}): string =>
  renderToStaticMarkup(
    <SettingsModal
      boardId="Board 3"
      gistId="abc123"
      resultUploadEnabled
      onTestConnection={vi.fn().mockResolvedValue("ok")}
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

describe("SettingsModal", () => {
  it("hides the gist id behind a password field", () => {
    const [boardInput, gistInput] = inputs(render());

    expect(gistInput).toContain('type="password"');
    expect(gistInput).toContain('value="abc123"');
    // Der Board-Name ist nicht schützenswert und bleibt lesbar.
    expect(boardInput).not.toContain('type="password"');
  });

  it("offers a save button", () => {
    expect(render()).toContain("Speichern");
  });

  it("prefills the fields from the stored settings", () => {
    const markup = render({ boardId: "Board 7", gistId: "xyz", resultUploadEnabled: false });
    const [boardInput, gistInput, uploadToggle] = inputs(markup);

    expect(boardInput).toContain('value="Board 7"');
    expect(gistInput).toContain('value="xyz"');
    expect(uploadToggle).not.toContain("checked");
  });

  it("offers the API login with e-mail and password while logged out", () => {
    const markup = render();
    const [, , , emailInput, passwordInput] = inputs(markup);

    expect(markup).toContain("API");
    expect(emailInput).toContain('type="email"');
    expect(passwordInput).toContain('type="password"');
    expect(markup).toContain("Anmelden");
    expect(markup).not.toContain("Abmelden");
  });

  it("shows the logged-in user with logout and connection test", () => {
    const markup = render({ apiEmail: "board@example.com" });

    expect(markup).toContain("Angemeldet als board@example.com");
    expect(markup).toContain("Abmelden");
    expect(markup).toContain("API-Verbindung testen");
    expect(markup).not.toContain('type="email"');
  });
});

describe("SettingsModal - Livescore", () => {
  const liveToggle = (markup: string): string | undefined =>
    inputs(markup).find((input, index, all) => index === all.length - 1 && input.includes("checkbox"));

  it("disables the livescore switch without login", () => {
    const markup = render();

    expect(markup).toContain("Livescore senden");
    expect(markup).toContain("Zuerst bei der API anmelden");
    expect(liveToggle(markup)).toContain("disabled");
  });

  it("offers the switch, default off, once logged in", () => {
    const markup = render({ apiEmail: "board@example.com" });

    expect(liveToggle(markup)).not.toContain("disabled");
    expect(liveToggle(markup)).not.toContain("checked");
    expect(markup).not.toContain("Zuerst bei der API anmelden");
  });

  it("shows the sender status line", () => {
    const markup = render({
      apiEmail: "board@example.com",
      liveScoreEnabled: true,
      liveScoreStatus: "Zuletzt gesendet: 19:05:07",
    });

    expect(liveToggle(markup)).toContain("checked");
    expect(markup).toContain("Zuletzt gesendet: 19:05:07");
  });
});
