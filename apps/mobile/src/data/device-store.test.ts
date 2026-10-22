import { createDeviceStore, DEVICE_PLACE, extensionOf, type FilePort } from "./device-store";

const ID = "11111111-1111-4111-8111-111111111111";

/** An in-memory sandbox: the contract the store keeps, without a phone. */
function memoryFiles() {
  const files = new Map<string, string>();
  const port: FilePort = {
    ensureDirectory: () => undefined,
    copy: (from, to) => void files.set(to, files.get(from) ?? "bytes"),
    names: (dir) => [...files.keys()].filter((k) => k.startsWith(`${dir}/`)).map((k) => k.slice(dir.length + 1)),
    remove: (uri) => void files.delete(uri),
  };
  return { files, port };
}

describe("the document store of the device", () => {
  it("keeps a copy named by the document's id, and finds it again", () => {
    const { port, files } = memoryFiles();
    const store = createDeviceStore(port, "file:///sandbox/");
    expect(store.uriOf(ID)).toBeNull();
    store.keep(ID, "Bail 2026.PDF", "file:///cache/picked.pdf");
    expect(store.uriOf(ID)).toBe(`file:///sandbox/documents/${ID}.pdf`);
    expect(files.has(`file:///sandbox/documents/${ID}.pdf`)).toBe(true);
  });

  it("forgets a document when it is removed, and a removed document that was never kept is no error", () => {
    const { port } = memoryFiles();
    const store = createDeviceStore(port, "file:///sandbox");
    store.keep(ID, "a.pdf", "file:///cache/a.pdf");
    store.remove(ID);
    expect(store.uriOf(ID)).toBeNull();
    expect(() => store.remove(ID)).not.toThrow();
  });

  it("only takes ids the server knows, never a path", () => {
    const store = createDeviceStore(memoryFiles().port, "file:///sandbox");
    for (const bad of ["../x", "nope", ""]) {
      expect(() => store.keep(bad, "a.pdf", "file:///a")).toThrow("not a document id");
      expect(() => store.uriOf(bad)).toThrow();
      expect(() => store.remove(bad)).toThrow();
    }
  });

  it("says where the documents live: on the device", () => {
    expect(createDeviceStore(memoryFiles().port, "file:///s").describe()).toBe(DEVICE_PLACE);
    expect(DEVICE_PLACE).toEqual({ kind: "device", owner: "device", residency: "device" });
  });

  it.each([
    ["Bail.PDF", "pdf"],
    ["notes.txt", "txt"],
    ["noext", "bin"],
    ["a.verylongext", "bin"],
  ])("reads the extension of %s as %s", (name, ext) => expect(extensionOf(name)).toBe(ext));
});
