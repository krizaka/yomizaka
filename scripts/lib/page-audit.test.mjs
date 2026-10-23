import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { problemsOf } from "./page-audit.mjs";

const fine = { h1: 1, scrollWidth: 360, clientWidth: 360, wide: [], unnamedButtons: 0, headerAction: { visible: true, named: true }, chips: [48] };

describe("what counts as a problem on a rendered page", () => {
  it("nothing, when the page fits, has one h1, named buttons and its action on screen", () => {
    assert.deepEqual(problemsOf("/app @360 dark", fine, { h1: true, headerAction: true }), []);
    assert.deepEqual(problemsOf("/fr @360 dark", { ...fine, h1: 0, headerAction: null }), []);
  });
  it("a horizontal overflow, or elements past the edge, on any page", () => {
    assert.match(problemsOf("x", { ...fine, scrollWidth: 400 })[0], /scrollWidth 400 > 360/);
    assert.match(problemsOf("x", { ...fine, wide: ["code.font-mono"] })[0], /past the edge \(code.font-mono\)/);
  });
  it("not exactly one h1, and unnamed buttons, on a signed-in page", () => {
    assert.match(problemsOf("x", { ...fine, h1: 0 }, { h1: true })[0], /0 h1/);
    assert.match(problemsOf("x", { ...fine, h1: 2 }, { h1: true })[0], /2 h1/);
    assert.match(problemsOf("x", { ...fine, unnamedButtons: 2 }, { h1: true })[0], /2 unnamed button/);
    assert.deepEqual(problemsOf("x", { ...fine, h1: 0 }), []);
  });
  it("the header's action missing, off screen or unnamed, where the page has one", () => {
    assert.match(problemsOf("x", { ...fine, headerAction: null }, { headerAction: true })[0], /no header action/);
    assert.match(problemsOf("x", { ...fine, headerAction: { visible: false, named: true } }, { headerAction: true })[0], /off screen/);
    assert.match(problemsOf("x", { ...fine, headerAction: { visible: true, named: false } }, { headerAction: true })[0], /no accessible name/);
  });
  it("a console error, and a chip under 44 px", () => {
    assert.match(problemsOf("x", fine, { errors: ["React error #418"] })[0], /console error — React error #418/);
    assert.match(problemsOf("x", { ...fine, chips: [40, 48] })[0], /40 px tall/);
  });
});
