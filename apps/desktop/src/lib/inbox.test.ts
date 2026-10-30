import type { FolderEntry } from "@krizaka/app-desktop";
import { describe, expect, it } from "vitest";

import { createInbox } from "./inbox";

const file = (name: string): FolderEntry => ({
  name,
  path: `/Users/eric/Baux/${name}`,
  isDir: false,
  size: 10,
  modified: 0,
  kind: "pdf",
});
const folder = (name: string): FolderEntry => ({
  name,
  path: `/Users/eric/Baux/${name}`,
  isDir: true,
  size: 0,
  modified: 0,
  kind: "folder",
});

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("a watched folder", () => {
  it("never sends what was there when it was turned on, only what arrives after, once", () => {
    const inbox = createInbox(memory());
    inbox.set("/Users/eric/Baux", true, [file("ancien.pdf"), folder("2025")]);
    expect(inbox.isWatched("/Users/eric/Baux")).toBe(true);
    expect(
      inbox.arrivals("/Users/eric/Baux", [file("ancien.pdf"), folder("2025"), file("nouveau.pdf")]).map((e) => e.name),
    ).toEqual(["nouveau.pdf"]);
    expect(inbox.arrivals("/Users/eric/Baux", [file("ancien.pdf"), file("nouveau.pdf")])).toEqual([]);
  });

  it("sends nothing for a folder that is not watched, or no longer is", () => {
    const inbox = createInbox(memory());
    expect(inbox.arrivals("/Users/eric/Baux", [file("bail.pdf")])).toEqual([]);
    inbox.set("/Users/eric/Baux", true);
    inbox.set("/Users/eric/Baux", false);
    expect(inbox.watched()).toEqual([]);
    expect(inbox.arrivals("/Users/eric/Baux", [file("bail.pdf")])).toEqual([]);
  });

  it("reads a damaged or refused storage as nothing watched", () => {
    expect(createInbox({ getItem: () => "{not json", setItem: () => undefined }).watched()).toEqual([]);
    expect(createInbox({ getItem: () => "[1,2]", setItem: () => undefined }).watched()).toEqual([]);
    const refusing = createInbox({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => refusing.set("/x", true)).not.toThrow();
  });
});
