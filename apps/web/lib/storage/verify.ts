import { lookup } from "node:dns/promises";
import net from "node:net";

import { bucketStore, checkEndpoint as checkEndpointSyntax, type FetchLike } from "@krizaka/storage";

import { isPrivateAddress } from "../webhooks/address";
import { documentStoreOver } from "./adapter";
import { MAX_SIGNED_URL_SECONDS } from "./config";
import { testConnection, type TestStep } from "./connection-test";
import type { DocumentStore } from "./port";
import { residencyOf } from "./regions";

/**
 * A workspace names its own S3 endpoint, and the server then calls it: a request to an address a user chose must never reach
 * Krizaka's own network. The package (`checkEndpoint`) refuses the written forms (scheme, credentials, local names, literal private
 * addresses); this adds what it cannot do, the DNS answer: a name that resolves to a private address is refused too.
 */
export class EndpointError extends Error {
  constructor(readonly code: "ENDPOINT_INVALID" | "ENDPOINT_NOT_ALLOWED", message: string) {
    super(message);
    this.name = "EndpointError";
  }
}

export type Resolver = (host: string) => Promise<string[]>;
const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

/** Checks an endpoint and returns it as an origin (`https://s3.example.com`). `allowLocal` is for development only (a local S3 server over http). */
export async function checkOwnEndpoint(raw: string, options: { allowLocal: boolean; resolve?: Resolver }): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new EndpointError("ENDPOINT_INVALID", "Not a web address");
  }
  if (options.allowLocal && (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.protocol === "http:") return url.origin;
  if (url.protocol !== "https:") throw new EndpointError("ENDPOINT_INVALID", "The endpoint must be an https address");
  if (url.username || url.password) throw new EndpointError("ENDPOINT_INVALID", "No credentials in the address");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") && !net.isIP(host)) throw new EndpointError("ENDPOINT_NOT_ALLOWED", "This address is not allowed");
  try {
    checkEndpointSyntax(url.origin);
  } catch {
    throw new EndpointError("ENDPOINT_NOT_ALLOWED", "This address is not allowed");
  }
  const addresses = net.isIP(host) ? [host] : await (options.resolve ?? defaultResolver)(host).catch(() => []);
  if (addresses.length === 0) throw new EndpointError("ENDPOINT_INVALID", "This address does not resolve");
  if (addresses.some(isPrivateAddress)) throw new EndpointError("ENDPOINT_NOT_ALLOWED", "This address is not allowed");
  return url.origin;
}

/** A workspace's own bucket as a DocumentStore: Yomizaka's keys under `yomizaka/`, the region table says where it is, the workspace owns it. */
export function ownBucketStore(c: S3Candidate & { endpoint: string }, now: () => Date, call: FetchLike = fetch as unknown as FetchLike): DocumentStore {
  const objects = bucketStore({ endpoint: c.endpoint, region: c.region, bucket: c.bucket, accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, prefix: "yomizaka", fetch: call, clock: { now } });
  return documentStoreOver(objects, { kind: "s3", endpoint: new URL(c.endpoint).host, region: c.region, residency: residencyOf(c.region), encrypted: false, owner: "workspace", devOnly: false }, MAX_SIGNED_URL_SECONDS);
}

export interface S3Candidate {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface Verification {
  ok: boolean;
  steps: TestStep[];
  /** The address as it will be used (an origin), the host shown to the person, the region and where that region is. */
  origin: string | null;
  host: string | null;
  region: string;
  residency: "canada" | "elsewhere";
  error: "ENDPOINT_INVALID" | "ENDPOINT_NOT_ALLOWED" | null;
}

/**
 * Verifies a workspace's own S3 before it is used or saved: the endpoint must be a public https address (never Krizaka's own
 * network), then a probe object is written, read back and deleted. Says what it found, including where the data would live.
 */
export async function verifyS3(
  candidate: S3Candidate,
  deps: { allowLocal: boolean; resolve?: Resolver; now: () => Date; probeId: string; makeStore?: (c: S3Candidate & { endpoint: string }) => DocumentStore },
): Promise<Verification> {
  const base = { steps: [] as TestStep[], region: candidate.region, residency: residencyOf(candidate.region), origin: null, host: null };
  let origin: string;
  try {
    origin = await checkOwnEndpoint(candidate.endpoint, { allowLocal: deps.allowLocal, resolve: deps.resolve });
  } catch (error) {
    if (error instanceof EndpointError) return { ...base, ok: false, error: error.code };
    throw error;
  }
  const store = (deps.makeStore ?? ((c) => ownBucketStore(c, deps.now)))({ ...candidate, endpoint: origin });
  const out = await testConnection(store, deps.probeId, () => deps.now().getTime());
  return { ok: out.ok, steps: out.steps, origin, host: new URL(origin).host, region: candidate.region, residency: residencyOf(candidate.region), error: null };
}
