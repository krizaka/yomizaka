import type { FetchLike } from "@krizaka/storage";

export interface Held {
  bytes: Uint8Array;
  contentType: string;
}

/** A tiny S3 (path-style): PUT, GET, DELETE on `<origin>/<bucket>/<key>`; every request must be signed (Signature V4). */
export function fakeBucket() {
  const objects = new Map<string, Held>();
  const calls: { method: string; url: string; signed: boolean }[] = [];
  const fetchLike: FetchLike = async (url, init) => {
    const target = new URL(url);
    const key = `${target.origin}${target.pathname}`;
    calls.push({
      method: init.method,
      url,
      signed: (init.headers.authorization ?? init.headers.Authorization ?? "").startsWith("AWS4-HMAC-SHA256"),
    });
    const reply = (status: number, body?: Held) => ({
      ok: status < 300,
      status,
      headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? (body?.contentType ?? null) : null) },
      arrayBuffer: async () => new Uint8Array(body?.bytes ?? []).buffer,
      text: async () => "",
    });
    if (init.method === "PUT") {
      objects.set(key, { bytes: init.body!, contentType: init.headers["content-type"] ?? "application/octet-stream" });
      return reply(200);
    }
    if (init.method === "GET") return objects.has(key) ? reply(200, objects.get(key)) : reply(404);
    if (init.method === "DELETE") return reply(objects.delete(key) ? 204 : 404);
    return reply(405);
  };
  return { objects, calls, fetchLike };
}
