#!/usr/bin/env node
// The post-deploy smoke of the lease check (yomizaka P0, 2026-10-29: « Orazaka refused the document as sent » on dev for a lease while
// every unit test was green, because no test crossed the real Orazaka). ONE real lease check on a deployed Yomizaka, as a persona:
//   sign in ONCE (bearer) -> upload the demo lease -> wait for its text -> start the compliance check the way the UI does -> wait for the
//   report -> delete the document. It fails, with the code Yomizaka answered (never a secret), if the engine refuses or the report is empty.
//
//   SMOKE_EMAIL=… SMOKE_PASSWORD=… node scripts/smoke-lease-check.mjs --base https://dev.yomizaka.com
import { fileURLToPath } from "node:url";

import { generateDocument } from "./demo-documents/index.mjs";

/** The Québec lease versions the UI asks for (apps/web/lib/rulesets.ts; apps/web/lib/orazaka-contract.test.ts keeps them equal). */
export const LEASE_REFS = [
  { effectiveFrom: null, ref: "qc-residential-lease/2024-02-21" },
  { effectiveFrom: "2026-10-24", ref: "qc-residential-lease/2026-10-24" },
];

/** The lease ruleset in force on a day (yyyy-mm-dd), as the UI picks it. Pure. */
export function leaseRefOn(asOf) {
  let current = null;
  for (const v of LEASE_REFS) if ((v.effectiveFrom === null || v.effectiveFrom <= asOf) && (current === null || (v.effectiveFrom ?? "") >= (current.effectiveFrom ?? ""))) current = v;
  return current.ref;
}

/** The day in Montréal (the calendar of the law). Pure. */
export const montrealDay = (now) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** What the smoke says for an answer that is not the expected one: the status and the stable code, never the body in full. Pure. */
export function describeFailure(step, status, body) {
  const code = typeof body?.code === "string" ? body.code : typeof body?.error?.code === "string" ? body.error.code : "no code";
  return `${step}: HTTP ${status}, ${code}`;
}

export async function smokeLeaseCheck({ base, email, password, fetchImpl = fetch, now = () => new Date(), wait = sleep, timeoutMs = 240_000, log = () => {} }) {
  if (!email || !password) throw new Error("SMOKE_EMAIL and SMOKE_PASSWORD are required (the persona)");
  const call = async (path, init = {}, token) => {
    const res = await fetchImpl(`${base}${path}`, { ...init, headers: { accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers } });
    return { res, body: await res.json().catch(() => null) };
  };
  const signIn = await call("/api/auth/sign-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, client: "native" }) });
  if (!signIn.res.ok || typeof signIn.body?.token !== "string") throw new Error(describeFailure("sign-in", signIn.res.status, signIn.body));
  const token = signIn.body.token;
  let documentId = null;
  try {
    const lease = await generateDocument("bail-rosemont-1-conforme");
    const form = new FormData();
    form.set("file", new File([lease.bytes], "smoke-bail.pdf", { type: "application/pdf" }));
    form.set("kind", "lease");
    const upload = await call("/api/documents", { method: "POST", body: form }, token);
    if (!upload.res.ok) throw new Error(describeFailure("upload", upload.res.status, upload.body));
    documentId = upload.body.document.id;
    log(`uploaded ${documentId}`);
    const deadline = now().getTime() + timeoutMs;
    for (;;) {
      const read = await call(`/api/documents/${documentId}`, {}, token);
      if (!read.res.ok) throw new Error(describeFailure("read the document", read.res.status, read.body));
      const extraction = read.body.document.extraction;
      if (extraction === "failed") throw new Error("the text of the lease could not be read");
      if (extraction !== "queued" && extraction !== "running") break;
      if (now().getTime() > deadline) throw new Error("the text of the lease was not read in time");
      await wait(2000);
    }
    const asOf = montrealDay(now());
    const start = await call(`/api/documents/${documentId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studio: "compliance-check", jurisdiction: "QC", ruleset: leaseRefOn(asOf), asOf }) }, token);
    if (!start.res.ok) throw new Error(describeFailure("start the lease check", start.res.status, start.body));
    let analysis = start.body.analysis;
    while (analysis.status === "running") {
      if (now().getTime() > deadline) throw new Error("the lease check did not finish in time");
      await wait(3000);
      const poll = await call(`/api/documents/${documentId}/analyses/${analysis.id}`, {}, token);
      if (!poll.res.ok) throw new Error(describeFailure("read the lease check", poll.res.status, poll.body));
      analysis = poll.body.analysis;
    }
    if (analysis.status !== "succeeded") throw new Error(`the lease check ended ${analysis.status}`);
    const report = analysis.report;
    if (!report || !Array.isArray(report.findings)) throw new Error("the lease check succeeded without a report with findings");
    return { analysisId: analysis.id, runId: analysis.runId ?? null, findings: report.findings.length, facts: report.facts ? Object.keys(report.facts) : [] };
  } finally {
    if (documentId) await call(`/api/documents/${documentId}`, { method: "DELETE" }, token).catch(() => {});
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--base");
  const base = (i >= 0 ? process.argv[i + 1] : "https://dev.yomizaka.com").replace(/\/$/, "");
  try {
    const result = await smokeLeaseCheck({ base, email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD, log: console.log });
    console.log(`lease check on ${base}: succeeded, ${result.findings} findings, facts [${result.facts.join(", ")}], run ${result.runId}`);
  } catch (error) {
    console.error(`lease check on ${base} FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
