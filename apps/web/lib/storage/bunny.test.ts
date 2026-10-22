import crypto from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bunnyStore } from "./bunny";
import { documentStoreContract } from "./contract.testkit";
import { encrypted } from "./encrypted";

/** A stand-in for Bunny's storage API: PUT, GET and DELETE under /{zone}/…, refused without the zone's AccessKey, 404 for what is not there. */
let server: Server;
let port = 0;
const seen: { method: string; path: string }[] = [];
const objects = new Map<string, Buffer>();

beforeAll(async () => {
  server = createServer((req, res) => {
    seen.push({ method: req.method ?? "", path: req.url ?? "" });
    if (req.headers.accesskey !== "zone-password") {
      res.writeHead(401).end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const path = req.url ?? "";
      if (req.method === "PUT") {
        objects.set(path, Buffer.concat(chunks));
        res.writeHead(201).end('{"HttpCode":201}');
      } else if (req.method === "GET") {
        const found = objects.get(path);
        if (found) res.writeHead(200).end(found);
        else res.writeHead(404).end();
      } else if (req.method === "DELETE") {
        res.writeHead(objects.delete(path) ? 200 : 404).end();
      } else res.writeHead(405).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

// The adapter talks https to a host; the test points `fetch` at the local server.
const local: typeof fetch = (input, init) => fetch(String(input).replace("https://bunny.test", `http://127.0.0.1:${port}`), init);
const make = (extra = {}) => bunnyStore({ endpoint: "bunny.test", zone: "krizaka-assets", accessKey: "zone-password", prefix: "yomizaka", fetch: local, now: () => new Date(), ...extra });

describe("bunny adapter", () => {
  documentStoreContract("bunny", () => make());
  documentStoreContract("bunny + encryption", () => encrypted(make(), crypto.randomBytes(32)));

  it("keeps everything under the private yomizaka/ prefix of its zone, through the authenticated API", async () => {
    seen.length = 0;
    await make().put("o1/d1/file.pdf", new Uint8Array([1]), { contentType: "application/pdf" });
    expect(seen[0]).toEqual({ method: "PUT", path: "/krizaka-assets/yomizaka/o1/d1/file.pdf" });
  });
  it("says it is for development and fictional data only, never encrypted by itself, outside Canada", () => {
    expect(make().describe()).toMatchObject({ kind: "bunny", devOnly: true, residency: "elsewhere", encrypted: false });
  });
  it("refuses with a clear error when the zone refuses the key", async () => {
    await expect(make({ accessKey: "wrong" }).put("a/b.pdf", new Uint8Array([1]), { contentType: "application/pdf" })).rejects.toMatchObject({ status: 502 });
  });
  it("hands out a signed link only when the pull zone has token authentication, and never carries the key", async () => {
    expect(await make().signedUrl("o/d.pdf", 60)).toBeNull();
    const link = (await make({ pullHostname: "cdn.test", tokenKey: "token-key" }).signedUrl("o/d.pdf", 60))!;
    expect(link).toMatch(/^https:\/\/cdn\.test\/yomizaka\/o\/d\.pdf\?token=[A-Za-z0-9_-]+&expires=\d+$/);
    expect(link).not.toContain("token-key");
    expect(link).not.toContain("zone-password");
  });
});
