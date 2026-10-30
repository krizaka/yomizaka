// The journey of the hydrated first paint (app-home-pending) flaked on a shot that was right: two things moved under it.
//  - the date in words (« Today ») is written by the SERVER's clock, which the browser's frozen clock does not reach, and the masked
//    box takes the width of its text: « vendredi 30 octobre 2026 » (24 letters) one day, « jeudi 29 octobre 2026 » (21) the next;
//  - the account mark swaps its initial for the default picture once the image is decoded: a shot taken a few frames earlier shows the initial.
// Both are settled before the shot, in `ready`, so a day or a slow runner cannot change the capture.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it as test } from "vitest";

const source = readFileSync(new URL("../apps/web/e2e/visual/journeys.visual.mjs", import.meta.url), "utf8");
const pending = source.split("\n").find((line) => line.includes('name: "app-home-pending"')) ?? "";

test("the pending first paint settles the date and the account picture before the shot", () => {
  assert.match(pending, /ready: settleHeaderLive/, "the pending journey must run settleHeaderLive");
  const body = source.slice(source.indexOf("async function settleHeaderLive"));
  assert.match(body, /data-testid="today"/, "waits for the date box (the server froze its text: APP_VISUAL_NOW)");
  assert.match(body, /naturalWidth/, "waits for the account picture to be decoded");
});

test("the dates of the library come from the injected clock: the seed is stamped from APP_VISUAL_NOW, the journey masks nothing (#641)", () => {
  const documents = source.split("\n").find((line) => line.includes('name: "documents"')) ?? "";
  assert.doesNotMatch(documents, /ready:/, "the documents journey does not rewrite its dates: they are already fixed at the source");
  assert.doesNotMatch(source, /addStyleTag|replaceChildren\(/, "no width override and no text swap over the page's dates (clock injection, not masking)");
  const start = readFileSync(new URL("./ci-visual-start.sh", import.meta.url), "utf8");
  assert.ok(start.indexOf("export APP_VISUAL_NOW=") > 0 && start.indexOf("export APP_VISUAL_NOW=") < start.indexOf("demo-seed/cli.mjs"), "the clock is frozen before the cast is seeded");
  const cli = readFileSync(new URL("./demo-seed/cli.mjs", import.meta.url), "utf8");
  assert.match(cli, /APP_VISUAL_NOW/, "the seed reads the frozen clock");
  const seed = readFileSync(new URL("./demo-seed/seed.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(seed.slice(seed.indexOf("async function seedInTransaction")), /make_interval|created_at, finished_at\)\n\s*SELECT[^\n]*now\(\)/, "reports are stamped from the injected clock, not now()");
});
