import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";

// A bug means a missing guard: zizmor and Sonar (S7631) refused a workflow that ran with the org's secrets after a workflow_run.
const source = readFileSync(new URL("../.github/workflows/download-videos.yml", import.meta.url), "utf8");
const code = source.replace(/^\s*#.*$/gm, "");

describe("the download videos workflow", () => {
  it("runs on a schedule and on demand, never on a workflow_run", () => {
    assert.match(code, /schedule:/);
    assert.match(code, /workflow_dispatch:/);
    assert.doesNotMatch(code, /workflow_run/);
  });
  // Run 41135654722: the web job's trim died on a runner without ffprobe.
  it("installs ffmpeg before the web films are trimmed, and the trim fails loudly without it", () => {
    assert.ok(
      code.indexOf("apt-get install -y --no-install-recommends ffmpeg") < code.indexOf("film-trim.mjs showcase-web"),
    );
    assert.match(readFileSync(new URL("./film-trim.mjs", import.meta.url), "utf8"), /result\.error/);
  });
  it("names the secrets it passes, never inherits them", () => {
    assert.doesNotMatch(code, /secrets:\s*inherit/);
    assert.match(code, /MEDIA_STORAGE_API_KEY: \$\{\{ secrets\.MEDIA_STORAGE_API_KEY \}\}/);
  });
  it("never writes the demo password to GITHUB_ENV", () => {
    assert.doesNotMatch(code, /GITHUB_ENV/);
  });
  // yomizaka#575: the poster is the frame at 2 s; a film that opens on the sign-in made a sign-in the poster of the binder.
  it("films the binder already signed in and opens the report film on the report (the poster is the frame at 2 s)", () => {
    assert.match(code, /showcase-web\.mjs[^\n]*--sign-in off/);
    const script = readFileSync(new URL("./showcase-web.mjs", import.meta.url), "utf8");
    assert.match(script, /goto\(`\$\{base\}\/\$\{locale\}\$\{reportPath\}\/rapport`/);
  });
  it("waits for the navigation to the document before it reads the URL (a click is a client navigation)", () => {
    const script = readFileSync(new URL("./showcase-web.mjs", import.meta.url), "utf8");
    const click = script.indexOf("firstDocument(page).click()");
    const wait = script.indexOf("waitForURL(", click);
    const read = script.indexOf("new URL(page.url())", click);
    assert.ok(click > 0 && wait > click && read > wait, "waitForURL must sit between the click and the URL read");
  });
});
