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
  uploadStatus: "not-uploaded",
  ...overrides,
});

const render = (entries: MatchHistoryEntry[], apiLoggedIn = false): string =>
  renderToStaticMarkup(
    <MatchHistoryModal
      entries={entries}
      onUpload={vi.fn()}
      onApiUpload={vi.fn()}
      apiLoggedIn={apiLoggedIn}
      onClose={vi.fn()}
    />
  );

// Der Upload-Button eines Eintrags, so wie er im Markup steht.
const uploadButtons = (markup: string): string[] =>
  [...markup.matchAll(/<button[^>]*match-history__upload[^>]*>.*?<\/button>/g)].map((m) => m[0]);

const apiUploadButtons = (markup: string): string[] =>
  [...markup.matchAll(/<button[^>]*match-history__api-upload[^>]*>.*?<\/button>/g)].map((m) => m[0]);

describe("MatchHistoryModal", () => {
  it("shows every detail that would go into the gist", () => {
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
    const markup = render([entry({ uploadStatus: "uploaded" })]);

    expect(markup).toContain("Erfolgreich hochgeladen");
    expect(uploadButtons(markup)).toHaveLength(0);
  });

  it("offers an upload for a match that did not reach the gist", () => {
    const markup = render([entry({ uploadStatus: "not-uploaded" })]);

    expect(markup).toContain("Nicht hochgeladen");
    expect(uploadButtons(markup)).toHaveLength(1);
  });

  it("names the disabled upload switch as the reason and still offers an upload", () => {
    const markup = render([entry({ uploadStatus: "upload-disabled" })]);

    expect(markup).toContain("Nicht übertragen (Upload deaktiviert)");
    expect(uploadButtons(markup)).toHaveLength(1);
  });

  it("lists several matches and only offers uploads for the open ones", () => {
    const markup = render([
      entry({ id: "a", uploadStatus: "uploaded" }),
      entry({ id: "b", uploadStatus: "not-uploaded" }),
      entry({ id: "c", uploadStatus: "upload-disabled" }),
    ]);

    expect(uploadButtons(markup)).toHaveLength(2);
  });

  it("stays usable without any finished match", () => {
    expect(render([])).toContain("Noch kein Match beendet.");
  });

  it("shows gist and API status separately", () => {
    const markup = render([entry({ uploadStatus: "uploaded", apiUploadStatus: "not-logged-in" })], true);

    expect(markup).toContain("Gist: Erfolgreich hochgeladen");
    expect(markup).toContain("API: Nicht angemeldet");
    expect(render([entry({ apiUploadStatus: "upload-disabled" })])).toContain(
      "API: Nicht übertragen (Upload deaktiviert)"
    );
    // Einträge aus der Zeit vor dem API-Ziel.
    expect(render([entry()])).toContain("API: Nicht hochgeladen");
  });

  it("offers the API upload until the result is in the API", () => {
    expect(apiUploadButtons(render([entry({ apiUploadStatus: "not-uploaded" })], true))).toHaveLength(1);
    expect(apiUploadButtons(render([entry({ apiUploadStatus: "uploaded" })], true))).toHaveLength(0);
    expect(render([entry({ apiUploadStatus: "uploaded" })], true)).toContain("API: Erfolgreich hochgeladen");
  });

  it("disables the API upload without a login and says where to log in", () => {
    const markup = render([entry({ apiUploadStatus: "not-uploaded" })], false);
    const [button] = apiUploadButtons(markup);

    expect(button).toContain("Upload zur API");
    expect(button).toContain("disabled");
    expect(markup).toContain("In den Einstellungen anmelden");
    expect(apiUploadButtons(render([entry()], true))[0]).not.toContain("disabled");
  });
});
