import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("the side is chosen at onboarding and changeable in settings", () => {
  it("the library never asks: it sends to /bienvenue until a side is chosen", () => {
    expect(read("components/console/LibraryView.tsx")).not.toContain("<PerspectiveChooser");
    expect(read("app/[locale]/(app)/app/page.tsx")).toContain("onboardingTarget(");
    const welcome = read("app/[locale]/(app)/app/bienvenue/page.tsx");
    expect(welcome).toContain("<PerspectiveChooser");
    expect(welcome).toContain("welcomeTarget(");
  });
  it("settings change it, the document page follows it", () => {
    expect(read("app/[locale]/(app)/app/settings/[section]/page.tsx")).toContain("perspective={session.account.perspective}");
    expect(read("components/console/DocumentView.tsx")).toContain("firstCheck(perspective, doc.kind)");
    expect(read("app/[locale]/(app)/app/documents/[id]/[tab]/page.tsx")).toContain("perspective={session.account.perspective}");
  });
});
