import { describe, expect, it } from "vitest";

import { DECISION } from "./decl";
import { press } from "./press";

describe("two presses to refuse", () => {
  it("sends a move that needs no confirmation at once", () => {
    expect(press(null, DECISION.selected, false)).toEqual({ armed: null, send: true });
  });
  it("arms a move that asks for it on the first press and sends it on the second", () => {
    const first = press(null, DECISION.notSelected, true);
    expect(first).toEqual({ armed: DECISION.notSelected, send: false });
    expect(press(first.armed, DECISION.notSelected, true)).toEqual({ armed: null, send: true });
  });
  it("disarms when another target is pressed in between: the first press of that one only arms it", () => {
    expect(press(DECISION.notSelected, DECISION.selected, false)).toEqual({ armed: null, send: true });
    expect(press(DECISION.notSelected, "autre", true)).toEqual({ armed: "autre", send: false });
  });
});
