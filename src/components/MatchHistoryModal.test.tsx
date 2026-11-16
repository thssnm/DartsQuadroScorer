import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MatchHistoryModal } from "./MatchHistoryModal";
import type { MatchHistoryEntry } from "../game/persistence";

const entry = (overrides: Partial<MatchHistoryEntry> = {}): MatchHistoryEntry => ({
  id: "entry-1",
  boardName: "Board 3",
  home: "Alice",
  guest: "Bob",
  legsHome: 2,
  legsGuest: 1,
  averageHome: 61.5,
  averageGuest: 48.2,
  highlights: ["180 (Alice)", "121 Finish (Bob)"],
  updatedAt: "2026-10-07T18:30:00.000Z",
  apiUploadStatus: "not-uploaded",
  ...overrides,
});

const render = (entries: MatchHistoryEntry[], apiLoggedIn = true): string =>
  renderToStaticMarkup(
    <MatchHistoryModal entries={entries} onApiUpload={vi.fn()} apiLoggedIn={apiLoggedIn} onClose={vi.fn()} />
  );

// Der Upload-Button eines Eintrags, so wie er im Markup steht.
const uploadButtons = (markup: string): string[] =>
  [...markup.matchAll(/<button[^>]*match-history__api-upload[^>]*>.*?<\/button>/g)].map((m) => m[0]);

describe("MatchHistoryModal", () => {
  it("shows every detail that goes to the API", () => {
    const markup = render([entry()]);

    expect(markup).toContain("Alice 2 : 1 Bob");
    expect(markup).toContain("Board 3");
    expect(markup).toContain("61.5");
    expect(markup).toContain("48.2");
    expect(markup).toContain("180 (Alice)");
    expect(markup).toContain("121 Finish (Bob)");
    // Zeitstempel in lokaler Schreibweise.
    expect(markup).toContain("2026");
  });

  it("labels a successful upload and hides the upload button", () => {
    const markup = render([entry({ apiUploadStatus: "uploaded" })]);

    expect(markup).toContain("Erfolgreich hochgeladen");
    expect(uploadButtons(markup)).toHaveLength(0);
  });

  it("offers an upload for a match that did not reach the API", () => {
    const markup = render([entry({ apiUploadStatus: "not-uploaded" })]);

    expect(markup).toContain("Nicht hochgeladen");
    expect(uploadButtons(markup)).toHaveLength(1);
  });

  it("names the reason for a skipped upload and still offers an upload", () => {
    expect(render([entry({ apiUploadStatus: "upload-disabled" })])).toContain(
      "Nicht übertragen (Upload deaktiviert)"
    );
    expect(render([entry({ apiUploadStatus: "not-logged-in" })])).toContain("Nicht angemeldet");
    expect(uploadButtons(render([entry({ apiUploadStatus: "upload-disabled" })]))).toHaveLength(1);
  });

  it("treats an entry without a status as not uploaded", () => {
    // Einträge aus der Zeit vor dem API-Ziel.
    const markup = render([entry({ apiUploadStatus: undefined })]);

    expect(markup).toContain("Nicht hochgeladen");
    expect(uploadButtons(markup)).toHaveLength(1);
  });

  it("lists several matches and only offers uploads for the open ones", () => {
    const markup = render([
      entry({ id: "a", apiUploadStatus: "uploaded" }),
      entry({ id: "b", apiUploadStatus: "not-uploaded" }),
      entry({ id: "c", apiUploadStatus: "upload-disabled" }),
    ]);

    expect(uploadButtons(markup)).toHaveLength(2);
  });

  it("stays usable without any finished match", () => {
    expect(render([])).toContain("Noch kein Match beendet.");
  });

  it("disables the upload without a login and says where to log in", () => {
    const markup = render([entry()], false);
    const [button] = uploadButtons(markup);

    expect(button).toContain("Upload");
    expect(button).toContain("disabled");
    expect(markup).toContain("In den Einstellungen anmelden");
    expect(uploadButtons(render([entry()], true))[0]).not.toContain("disabled");
  });
});
