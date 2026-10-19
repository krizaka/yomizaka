import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("the side is chosen at onboarding and changeable in settings", () => {
  it("the library asks until a side is chosen, and links to settings after", () => {
    const library = read("components/console/LibraryView.tsx");
    expect(library).toContain("perspective === null");
    expect(library).toContain("<PerspectiveChooser");
    expect(library).toContain("/app/settings");
  });
  it("settings change it, the document page follows it", () => {
    expect(read("app/[locale]/(app)/app/settings/page.tsx")).toContain("<PerspectiveChooser current=");
    expect(read("components/console/DocumentView.tsx")).toContain("firstCheck(perspective, doc.kind)");
    expect(read("app/[locale]/(app)/app/documents/[id]/page.tsx")).toContain("perspective={session.account.perspective}");
  });
});
