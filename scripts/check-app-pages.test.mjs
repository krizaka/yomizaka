import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { PAGES, railRoutes } from "./check-app-pages.mjs";
import { problemsOf } from "./lib/page-audit.mjs";

describe("the signed-in pages crawl (yomizaka#457: « Dossiers » crashed unseen, it was in no list)", () => {
  it("audits « Dossiers » and every route the sidebar offers", () => {
    assert.ok(PAGES.includes("/app/dossiers"));
    const rail = ["/en/app", "/en/app/dossiers", "/en/app/documents?x=1", "/en/app/verifications", "/en/app?period=30d&collection=abc", "/fr/app/search", "https://x.test/en/app/y", "/en/app/settings/"];
    assert.deepEqual(railRoutes(rail, "en"), ["/app", "/app/dossiers", "/app/documents", "/app/verifications", "/app/settings"]);
  });
  it("a page that rendered its error state is a problem, even with one h1", () => {
    const ok = { h1: 1, scrollWidth: 400, clientWidth: 400, wide: [], unnamedButtons: 0, segmentError: false };
    assert.deepEqual(problemsOf("/app/dossiers @1440 dark", ok, { h1: true }), []);
    assert.match(problemsOf("/app/dossiers @1440 dark", { ...ok, segmentError: true }, { h1: true })[0], /error state/);
  });
  it("a run id wrapped a character per line is a problem (the Checks table)", () => {
    const ok = { h1: 1, scrollWidth: 400, clientWidth: 400, wide: [], unnamedButtons: 0, wrapped: [] };
    assert.deepEqual(problemsOf("/app/verifications @390 dark", ok, { h1: true }), []);
    assert.match(problemsOf("/app/verifications @390 dark", { ...ok, wrapped: ["0198f2ab-7c1d-7e"] }, { h1: true })[0], /one character per line/);
  });
});
