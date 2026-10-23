#!/usr/bin/env node
// The fictitious demo documents, generated in code (never committed).
//   node scripts/demo-documents/cli.mjs [--out <dir>] [--seed <n>]
import { DEFAULT_SEED, writeAll } from "./index.mjs";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const out = arg("out") ?? "demo-documents-out";
const seed = arg("seed") ? Number(arg("seed")) : DEFAULT_SEED;
if (!Number.isInteger(seed)) {
  console.error("demo-documents: --seed must be an integer");
  process.exit(1);
}
const docs = await writeAll(out, seed);
console.log(`demo-documents: ${docs.length} fictitious PDFs (seed ${seed}) written to ${out}`);
