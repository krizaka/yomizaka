#!/usr/bin/env node
// Records the real run the public page shows (« A real run », lib/demo-run.ts): a sample lease sent to Orazaka's
// compliance Studio on dev with Yomizaka's service key, polled until it ends, written with its run id and its report
// exactly as Orazaka returned them. Nothing is invented: no run, no demo.
//
//   AI_API_URL=https://dev.orazaka.com/edge AI_API_KEY=oz_… node scripts/record-demo.mjs   (the key is never printed)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SAMPLE_LEASE = `BAIL DE LOGEMENT — 4½, rue Saint-Denis, Montréal
Entre le locateur Monsieur Marc Tremblay, domicilié à Montréal,
et la locataire Madame Sophie Gagnon.
Durée : 12 mois, du 1er juillet 2026 au 30 juin 2027.
Loyer mensuel : 1 450 $, payable le premier jour du mois.
La locataire verse un dépôt de sécurité de 1 450 $ à la signature.
La locataire remet douze chèques postdatés.
Il est interdit d'avoir des enfants dans le logement.`;

const base = (process.env.AI_API_URL ?? "https://dev.orazaka.com/edge").replace(/\/$/, "");
const key = process.env.AI_API_KEY;

async function call(path, init = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: HTTP ${res.status}`);
  return res.json();
}

export function demoModule(run, report, document) {
  const data = { runId: run.id, studio: "compliance-check", blueprintVersion: run.blueprintVersion ?? null, finishedAt: run.finishedAt ?? new Date().toISOString(), document, report };
  return `import type { ComplianceReport } from "@yomizaka/core";

/**
 * The real run the public page shows (« A real run »): recorded from dev.orazaka.com by \`scripts/record-demo.mjs\` — a
 * sample lease sent to Orazaka's compliance Studio, the run id and the report exactly as they came back. \`null\` until
 * it has run: the page then says so instead of showing an invented result.
 */
export interface DemoRun {
  runId: string;
  studio: "compliance-check";
  blueprintVersion: string | null;
  finishedAt: string;
  document: string;
  report: ComplianceReport;
}

export const DEMO_RUN: DemoRun | null = ${JSON.stringify(data, null, 2)};
`;
}

async function main() {
  if (!key?.startsWith("oz_")) throw new Error("AI_API_KEY (oz_…) is not set");
  const installed = await call("/api/v1/studios/installations");
  if (!installed.some((i) => i.studioKey === "compliance-check")) await call("/api/v1/studios/compliance-check/installations?locale=en", { method: "POST", body: JSON.stringify({ config: {} }) });
  let run = await call("/api/v1/studios/compliance-check/runs", { method: "POST", body: JSON.stringify({ inputs: { document: SAMPLE_LEASE, jurisdiction: "QC", asOf: new Date().toISOString().slice(0, 10) } }) });
  console.log(`record-demo: run ${run.id} started`);
  for (let i = 0; i < 90 && !["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status); i++) {
    await new Promise((r) => setTimeout(r, 4000));
    run = await call(`/api/v1/studios/runs/${run.id}`);
  }
  if (run.status !== "SUCCEEDED") throw new Error(`run ${run.id} ended ${run.status}: ${run.errorMessage ?? ""}`);
  const raw = JSON.parse(run.outputs.find((o) => o.key === "report")?.value ?? "null");
  const report = raw?.report ?? raw;
  if (!report?.findings) throw new Error(`run ${run.id} has no compliance report`);
  writeFileSync(fileURLToPath(new URL("../lib/demo-run.ts", import.meta.url)), demoModule(run, report, SAMPLE_LEASE));
  console.log(`record-demo: run ${run.id} SUCCEEDED — ${report.findings.length} findings written to lib/demo-run.ts`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`record-demo: ${error.message}`);
    process.exit(1);
  });
}
