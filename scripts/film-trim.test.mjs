import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";

import { assertStart, cutsOf, HOLD_S, parseBlacks, parseFreezes, trimFilter } from "./film-trim-lib.mjs";

const LOG = `lavfi.freezedetect.freeze_start: 0
lavfi.freezedetect.freeze_end: 2.4
lavfi.freezedetect.freeze_start: 6
lavfi.freezedetect.freeze_end: 9
lavfi.freezedetect.freeze_start: 12`;

describe("the trim of a film", () => {
  it("reads the freezes, an open one running to the end, and the blacks", () => {
    assert.deepEqual(parseFreezes(LOG, 14), [
      { start: 0, end: 2.4 },
      { start: 6, end: 9 },
      { start: 12, end: 14 },
    ]);
    assert.deepEqual(parseBlacks("black_start:0 black_end:1.2 black_duration:1.2"), [{ start: 0, end: 1.2 }]);
  });
  it("cuts the idle start whole, keeps a long still screen readable and leaves a short pause alone", () => {
    const cuts = cutsOf({ freezes: parseFreezes(LOG, 14), blacks: [] });
    assert.deepEqual(cuts, [
      [0, 2.4],
      [6 + HOLD_S, 9],
      [12 + HOLD_S, 14],
    ]);
    assert.deepEqual(cutsOf({ freezes: [{ start: 5, end: 6 }] }), []);
    assert.deepEqual(cutsOf({ freezes: [], blacks: [{ start: 0, end: 1.2 }] }), [[0, 1.2]]);
  });
  it("builds a filter that drops the ranges and closes the gaps", () => {
    assert.equal(trimFilter([]), null);
    assert.match(
      trimFilter([
        [0, 2.4],
        [7.2, 9],
      ]),
      /^select='not\(between\(t,0.000,2.400\)\+between\(t,7.200,9.000\)\)',setpts=N\/FRAME_RATE\/TB$/,
    );
  });
  it("fails when a film opens idle or blank for more than 1.5 s, passes one that moves at once", () => {
    assert.throws(() => assertStart({ freezes: [{ start: 0, end: 2.4 }] }), /opens idle or blank/);
    assert.throws(() => assertStart({ freezes: [], blacks: [{ start: 0, end: 3 }] }), /opens idle or blank/);
    assert.doesNotThrow(() =>
      assertStart({
        freezes: [
          { start: 0, end: 1.2 },
          { start: 6, end: 9 },
        ],
      }),
    );
  });
  it("is run on the web clips before they are uploaded", () => {
    const flow = readFileSync(new URL("../.github/workflows/download-videos.yml", import.meta.url), "utf8");
    assert.match(flow, /node scripts\/film-trim\.mjs showcase-web/);
  });
});
