import { testConnection,type TestStep } from "./connection-test";
import { checkEndpoint, EndpointError, type Resolver } from "./endpoint";
import type { DocumentStore } from "./port";
import { residencyOf } from "./regions";
import { s3Store } from "./s3";

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
    origin = await checkEndpoint(candidate.endpoint, { allowLocal: deps.allowLocal, resolve: deps.resolve });
  } catch (error) {
    if (error instanceof EndpointError) return { ...base, ok: false, error: error.code };
    throw error;
  }
  const store = (deps.makeStore ?? ((c) => s3Store({ ...c, prefix: "yomizaka", residency: residencyOf(c.region), owner: "workspace", now: deps.now })))({ ...candidate, endpoint: origin });
  const out = await testConnection(store, deps.probeId, () => deps.now().getTime());
  return { ok: out.ok, steps: out.steps, origin, host: new URL(origin).host, region: candidate.region, residency: residencyOf(candidate.region), error: null };
}
