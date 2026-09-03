import { describe, expect, it, vi } from "vitest";
import { UPLOAD_ERROR_MESSAGE, UploadErrorPopup } from "./UploadErrorPopup";

const collectText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).join("");
  if (value && typeof value === "object" && "props" in value) {
    return collectText((value as { props: { children?: unknown } }).props.children);
  }
  return "";
};

describe("UploadErrorPopup", () => {
  it("renders the exact tournament reporting message", () => {
    const element = UploadErrorPopup({ onConfirm: vi.fn() });

    expect(collectText(element)).toContain(UPLOAD_ERROR_MESSAGE);
  });
});
