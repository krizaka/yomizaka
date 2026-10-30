import { describe, expect, it } from "vitest";

import { codeOf, fieldText, HttpError, refuse } from "./http";

describe("fieldText", () => {
  const form = new FormData();
  form.set("token", "abc");
  form.set("upload", new File(["x"], "x.txt"));

  it("reads a text field", () => expect(fieldText(form, "token")).toBe("abc"));
  it("is empty for an absent field, a file or no form", () => {
    expect(fieldText(form, "missing")).toBe("");
    expect(fieldText(form, "upload")).toBe("");
    expect(fieldText(null, "token")).toBe("");
  });
});

describe("codeOf", () => {
  it("is the code an HttpError answers with", () =>
    expect(codeOf(refuse(400, "BAD_REQUEST", "no"), "FALLBACK")).toBe("BAD_REQUEST"));
  it("is the fallback when the body names no text code", () => {
    expect(codeOf(new HttpError(500, "no"), "FALLBACK")).toBe("FALLBACK");
    expect(codeOf(new HttpError(500, "no", { code: { nested: true } }), "FALLBACK")).toBe("FALLBACK");
  });
});
