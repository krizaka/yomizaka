import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * A workspace names its own S3 endpoint, and the server then calls it: that is a request to an address chosen by a user, so
 * it must never reach Krizaka's own network. HTTPS only (HTTP to localhost only in development, for the test server), no
 * private, loopback, link-local or metadata address, whether written as an IP or reached by a name.
 */
export class EndpointError extends Error {
  constructor(readonly code: "ENDPOINT_INVALID" | "ENDPOINT_NOT_ALLOWED", message: string) {
    super(message);
    this.name = "EndpointError";
  }
}

/** True for an address that is not the public internet's. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
  }
  return false;
}

export type Resolver = (host: string) => Promise<string[]>;
const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

/** Checks an endpoint and returns it as an origin (`https://s3.example.com`). `allowLocal` is for development only. */
export async function checkEndpoint(raw: string, options: { allowLocal: boolean; resolve?: Resolver }): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new EndpointError("ENDPOINT_INVALID", "Not a web address");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (options.allowLocal && local && url.protocol === "http:") return url.origin;
  if (url.protocol !== "https:") throw new EndpointError("ENDPOINT_INVALID", "The endpoint must be an https address");
  if (url.username || url.password) throw new EndpointError("ENDPOINT_INVALID", "No credentials in the address");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !net.isIP(host)) throw new EndpointError("ENDPOINT_NOT_ALLOWED", "This address is not allowed");
  const addresses = net.isIP(host) ? [host] : await (options.resolve ?? defaultResolver)(host).catch(() => []);
  if (addresses.length === 0) throw new EndpointError("ENDPOINT_INVALID", "This address does not resolve");
  if (addresses.some(isPrivateAddress)) throw new EndpointError("ENDPOINT_NOT_ALLOWED", "This address is not allowed");
  return url.origin;
}
