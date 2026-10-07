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
});
