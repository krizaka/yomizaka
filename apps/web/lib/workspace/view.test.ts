import { parseView, type SavedView } from "@krizaka/organize/contract";
import { describe, expect, it } from "vitest";

import { DECISION, KIND } from "./decl";
import { DEFAULT_CONFIGS } from "./defaults";
import { resolveView } from "./view";

const system = DEFAULT_CONFIGS[KIND.applicantFile].views;
const mine: SavedView = {
  id: "00000000-0000-4000-8000-0000000000aa",
  kind: KIND.applicantFile,
  authorId: "a",
  name: "Villeray",
  filters: { q: "villeray" },
  shared: false,
};
const read = (search: string) => parseView(new URLSearchParams(search));

describe("the view named by the address", () => {
  it("a system view alone is its own filters, and is not modified", () => {
    const r = resolveView(read("view=to_decide"), system, [mine], "fr");
    expect(r).toEqual({
      active: { kind: "system", id: "to_decide", label: "À décider" },
      filters: { status: [DECISION.toDecide] },
      modified: false,
    });
  });
  it("speaks the language of the person", () => {
    expect(resolveView(read("view=decided"), system, [], "en").active?.label).toBe("Decided");
  });
  it("a saved view is found by its id", () => {
    const r = resolveView(read(`view=${mine.id}`), system, [mine], "fr");
    expect(r.active).toEqual({ kind: "saved", id: mine.id, label: "Villeray" });
    expect(r.filters).toEqual({ q: "villeray" });
  });
  it("the filters of the address win over the view's, and mark it modified", () => {
    const r = resolveView(read("view=to_decide&status=retenu"), system, [], "fr");
    expect(r.filters).toEqual({ status: [DECISION.selected] });
    expect(r.modified).toBe(true);
  });
  it("the same filters as the view are not a modification", () => {
    expect(resolveView(read("view=to_decide&status=a_decider"), system, [], "fr").modified).toBe(false);
  });
  it("an unknown view is ignored and the address's filters stand", () => {
    expect(resolveView(read("view=nope&status=retenu"), system, [], "fr")).toEqual({
      active: null,
      filters: { status: [DECISION.selected] },
      modified: false,
    });
  });
});
