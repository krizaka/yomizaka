import { describe, expect, it } from "vitest";

import { profilePatch } from "@/components/console/AccountSettings";

const base = { name: "Éric", avatarSeed: "v2", locale: "fr" } as const;

describe("profilePatch: one save sends only what changed", () => {
  it("is null when nothing changed", () => {
    expect(profilePatch(base, { ...base })).toBeNull();
  });
  it("trims the name and clears it to null when it is emptied", () => {
    expect(profilePatch(base, { ...base, name: "  Éric T.  " })).toEqual({ name: "Éric T." });
    expect(profilePatch(base, { ...base, name: " " })).toEqual({ name: null });
  });
  it("sends the picture and the language that changed, and nothing else", () => {
    expect(profilePatch(base, { ...base, avatarSeed: "v5", locale: "en" })).toEqual({ avatarSeed: "v5", locale: "en" });
    expect(profilePatch({ ...base, avatarSeed: "" }, { ...base, avatarSeed: "" })).toBeNull();
  });
});
