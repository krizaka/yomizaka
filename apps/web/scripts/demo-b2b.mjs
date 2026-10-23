#!/usr/bin/env node
// The B2B demo for property managers (docs/demo-b2b.md): ten fictitious documents, a CSV, a batch through the batch endpoint of
// the web page and a second one through the public API v1 with a key, the reports, the signed PDF and the CSV export.
// Real and end to end against a deployment — nothing staged: the script only calls the routes the screens call.
//
//   node scripts/demo-b2b.mjs fixtures <dir> [stamp]    writes the documents and the CSV (the stamp makes every run's documents new)
//   QA_USER_EMAIL=… QA_USER_PASSWORD=… QA_ADMIN_EMAIL=… QA_ADMIN_PASSWORD=… [APP_BASE_URL=https://www.yomizaka.com] \
//     node scripts/demo-b2b.mjs run <dir> [stamp]       runs it (same stamp as the fixtures) and writes <dir>/run.json (ids, states, hashes — no secret)
//
// The passwords come from the environment (read them with ~/.krizaka-worktrees/tools/secret.sh @qa …) and are never printed; the
// API key is created for the run, kept in memory, and revoked at the end.
import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [command, dir = "demo-b2b-out", stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, "")] = process.argv.slice(2);
const BASE = (process.env.APP_BASE_URL ?? "https://www.yomizaka.com").replace(/\/$/, "");
/** Listed in the CSV and never sent: the row that shows what a forgotten file looks like. */
const NOT_SENT = new Set(["bail-107-jamais-envoye.pdf"]);
const BUILDING = "Immeuble Laurier (démo)";

/* ------------------------------------------------------------------------------------------------ the documents */

const lease = (n, title, clauses) =>
  [
    `BAIL DE LOGEMENT - ${title}`,
    `Dossier de demonstration DEMO-${stamp} (un dossier different a chaque execution : une verification identique deja faite est reutilisee, pas refaite).`,
    "Entre le locateur Gestion Laurier inc. (fictif), Montreal, et le locataire Camille Dubois (fictif).",
    `Logement : ${n}, immeuble Laurier, Montreal. Duree : 12 mois, du 1er juillet 2026 au 30 juin 2027.`,
    "Loyer mensuel : 1 150 $, payable le premier jour du mois.",
    "Section G - le loyer le plus bas paye au cours des douze mois precedant le debut du bail : 1 100 $.",
    ...clauses,
    "Fait a Montreal, le 15 mai 2026. Signatures du locateur et du locataire.",
  ].join("\n");

export const LEASES = {
  "bail-101-depot-cheques.pdf": lease("101", "logement 101", ["Le locataire verse un depot de securite de 1 150 $ a la signature.", "Le locataire remet douze cheques postdates."]),
  "bail-102-enfants-renonciation.pdf": lease("102", "logement 102", ["Il est interdit d'avoir des enfants dans le logement.", "Le locataire renonce a son droit au maintien dans les lieux a la fin du bail."]),
  "bail-103-conforme.pdf": lease("103", "logement 103", ["Le locateur remet un logement propre et en bon etat d'habitation.", "Le locataire peut sous-louer avec le consentement du locateur, qui ne le refuse pas sans motif serieux."]),
  "bail-104-depot-frais.docx": lease("104", "logement 104 (Word)", ["Le locataire verse un depot de garantie de 1 150 $ a la signature.", "Des frais de dossier de 150 $ sont payables par le locataire."]),
  "bail-105-depot.txt": lease("105", "logement 105 (texte)", ["Le locataire verse un depot de garantie equivalant a un mois de loyer a la signature."]),
};

const PAY = (employee, amount) => ["TALON DE PAIE - Entreprise Fictive inc.", `Dossier DEMO-${stamp}`, `Employe : ${employee} (fictif)`, "Periode : du 1er au 15 septembre 2026", `Salaire brut : ${amount} $`, "Deductions : 412,30 $", `Net : ${(amount - 412.3).toFixed(2)} $`].join("\n");

/* ------------------------------------------------------------------------------------------------ minimal zip (Word) */

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function zip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    parts.push(local, nameBytes, data);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(20, 6);
    head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(data.length, 20);
    head.writeUInt32LE(data.length, 24);
    head.writeUInt16LE(nameBytes.length, 28);
    head.writeUInt32LE(offset, 42);
    central.push(head, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBytes, end]);
}
const xml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function docx(text) {
  const paragraphs = text.split("\n").map((l) => `<w:p><w:r><w:t xml:space="preserve">${xml(l)}</w:t></w:r></w:p>`).join("");
  return zip([
    { name: "[Content_Types].xml", data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
    { name: "word/document.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`) },
  ]);
}

/* ------------------------------------------------------------------------------------------------ PDFs and the photo */

async function pdf(text, { producer, created, modified }) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setProducer(producer);
  doc.setCreator(producer);
  doc.setCreationDate(created);
  doc.setModificationDate(modified);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  text.split("\n").forEach((line, i) => page.drawText(line, { x: 56, y: 780 - i * 22, size: 11, font, color: rgb(0.1, 0.1, 0.1) }));
  return { doc, bytes: await doc.save() };
}

const CLEAN_DATES = { created: new Date("2026-05-15T10:00:00Z"), modified: new Date("2026-05-15T10:00:00Z") };

async function payslips() {
  const original = await pdf(PAY("Alex Test", 2150), { producer: "Dayforce Payroll 2026.1", ...{ created: new Date("2026-09-16T08:00:00Z"), modified: new Date("2026-09-16T08:00:00Z") } });
  // The edited one: the same file reopened, the gross pay covered by a white box and re-typed higher, saved by another tool, later.
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.load(original.bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.getPage(0);
  page.drawRectangle({ x: 54, y: 780 - 4 * 22 - 4, width: 300, height: 16, color: rgb(1, 1, 1) });
  page.drawText("Salaire brut : 3 950 $", { x: 56, y: 780 - 4 * 22, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
  doc.setProducer("iLovePDF");
  doc.setModificationDate(new Date("2026-10-02T21:40:00Z"));
  return { original: original.bytes, edited: await doc.save() };
}

async function photo() {
  const sharp = (await import("sharp")).default;
  const lines = lease("106", "logement 106 (photographie)", ["Le locataire verse un depot de securite de 1 150 $ a la signature."]).split("\n");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="100%" height="100%" fill="#f4f0e6"/>${lines.map((l, i) => `<text x="60" y="${120 + i * 60}" font-family="Helvetica,Arial,sans-serif" font-size="30" fill="#222">${xml(l)}</text>`).join("")}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

export const ROWS = [
  ["bail-101-depot-cheques.pdf", "compliance", "LAURIER-101"],
  ["bail-102-enfants-renonciation.pdf", "compliance", "LAURIER-102"],
  ["bail-103-conforme.pdf", "compliance", "LAURIER-103"],
  ["bail-104-depot-frais.docx", "compliance", "LAURIER-104"],
  ["bail-105-depot.txt", "compliance", "LAURIER-105"],
  ["talon-paie-original.pdf", "authenticity", "LOCATAIRE-A-PAIE"],
  ["talon-paie-modifie.pdf", "authenticity", "LOCATAIRE-B-PAIE"],
  ["bail-103-conforme.pdf", "authenticity", "LAURIER-103-FICHIER"],
  ["bail-107-jamais-envoye.pdf", "compliance", "LAURIER-107"],
];

async function writeFixtures() {
  await mkdir(dir, { recursive: true });
  const put = (name, data) => writeFile(join(dir, name), data);
  for (const [name, text] of Object.entries(LEASES)) {
    if (name.endsWith(".pdf")) await put(name, (await pdf(text, { producer: "Gestion Laurier (modele)", ...CLEAN_DATES })).bytes);
    else if (name.endsWith(".docx")) await put(name, docx(text));
    else await put(name, text);
  }
  const slips = await payslips();
  await put("talon-paie-original.pdf", slips.original);
  await put("talon-paie-modifie.pdf", slips.edited);
  await put("photo-bail-106.jpg", await photo());
  const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = "file,check,reference,collection";
  await put("lot-laurier.csv", `${[header, ...ROWS.map(([f, c, r]) => [f, c, r, BUILDING].map(cell).join(","))].join("\n")}\n`);
  console.log(`demo-b2b: ${Object.keys(LEASES).length + 3} documents and lot-laurier.csv written to ${dir}`);
}

/* ------------------------------------------------------------------------------------------------ the run */

class Session {
  jar = new Map();
  async call(path, init = {}) {
    const headers = { ...(init.headers ?? {}), ...(this.jar.size ? { cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}) };
    const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const at = pair.indexOf("=");
      this.jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return res;
  }
  async json(path, init) {
    const res = await this.call(path, init);
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }
  async signIn(email, password) {
    const r = await this.json("/api/auth/sign-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (r.status !== 200) throw new Error(`sign-in refused (${r.status})`);
  }
}

const need = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
};
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("demo-b2b:", ...a);

async function form(files, csv) {
  const f = new FormData();
  f.set("manifest", new File([csv], "lot-laurier.csv", { type: "text/csv" }));
  f.set("name", `${BUILDING} - ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
  for (const name of new Set(files)) if (!NOT_SENT.has(name)) f.append("files", new File([await readFile(join(dir, name))], name, { type: name.endsWith(".pdf") ? "application/pdf" : name.endsWith(".jpg") ? "image/jpeg" : name.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain" }));
  return f;
}

/** Reads the batch until it is finished (or `maxMinutes` pass), the way the page does: each read advances it. */
async function follow(read, maxMinutes = 25) {
  const stop = Date.now() + maxMinutes * 60_000;
  for (;;) {
    const batch = await read();
    if (batch.finishedAt || Date.now() > stop) return batch;
    await sleep(8000);
  }
}

async function run() {
  const run = { base: BASE, stamp, startedAt: new Date().toISOString() };
  const user = new Session();
  const admin = new Session();
  await user.signIn(need("QA_USER_EMAIL"), need("QA_USER_PASSWORD"));
  await admin.signIn(need("QA_ADMIN_EMAIL"), need("QA_ADMIN_PASSWORD"));
  const csv = await readFile(join(dir, "lot-laurier.csv"), "utf8");
  const files = ROWS.map((r) => r[0]);

  // 1. the manager: a profile, a building as a collection
  await user.json("/api/me/perspective", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ perspective: "landlord" }) });
  const overview = await user.json("/api/libraries");
  let library = overview.body.libraries[0];
  if (!library) library = (await user.json("/api/libraries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Gestion Laurier" }) })).body.library;
  let collection = library.collections?.find((c) => c.name === BUILDING);
  if (!collection) collection = (await user.json("/api/collections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ libraryId: library.id, name: BUILDING }) })).body.collection;
  run.collection = { id: collection.id, name: BUILDING };

  // 2. the batch, through the page's own endpoint: preview, then create
  const preview = await user.json("/api/batches/preview", { method: "POST", body: await form(files, csv) });
  run.preview = { status: preview.status, rows: preview.body?.rows?.map((r) => ({ line: r.line, file: r.file, state: r.state, errors: r.errors })) };
  const created = await user.json("/api/batches", { method: "POST", body: await form(files, csv) });
  if (created.status !== 201) throw new Error(`batch refused (${created.status}): ${JSON.stringify(created.body)}`);
  const finished = await follow(async () => (await user.json(`/api/batches/${created.body.batch.id}`)).body.batch);
  run.web = { batchId: finished.id, finishedAt: finished.finishedAt, counts: finished.counts, items: finished.items };
  const exported = await user.call(`/api/batches/${finished.id}/export`);
  run.web.csvExport = { status: exported.status, bytes: (await exported.text()).length };

  // 2b. the photo: a batch row cannot carry one (yomizaka gap), so it goes the way the page's uploader sends it, then a check on it
  const up = new FormData();
  up.set("file", new File([await readFile(join(dir, "photo-bail-106.jpg"))], "photo-bail-106.jpg", { type: "image/jpeg" }));
  const photoUpload = await user.json("/api/documents", { method: "POST", body: up });
  run.photo = { upload: photoUpload.status, documentId: photoUpload.body?.document?.id ?? photoUpload.body?.id, hasText: photoUpload.body?.document?.hasText, code: photoUpload.body?.code };
  if (run.photo.documentId) {
    const started = await user.json(`/api/documents/${run.photo.documentId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studio: "compliance-check", jurisdiction: "QC" }) });
    run.photo.check = { status: started.status, analysisId: started.body?.analysis?.id, code: started.body?.code };
  }

  // 3. the same, through API v1 with a key. A key is a Pro feature (the plan's allowance is an administrator's setting) and a QA
  // account has no card to go Pro with, so the demo raises the FREE plan's allowance for the duration of the run and puts it back.
  const allowance = { scope: "global", id: "", key: "plans.free.apiKeys" };
  const before = (await admin.json("/api/admin/settings?scope=global")).body;
  const previousOverride = before.overrides?.[allowance.key];
  const previous = previousOverride !== null && typeof previousOverride === "object" ? previousOverride.value : previousOverride;
  await admin.json("/api/admin/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...allowance, value: 2 }) });
  let keyId = null;
  try {
    const made = await user.json("/api/me/api-keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Demo ERP (supprimee apres la demo)", scopes: ["checks:write", "reports:read"], expiresInDays: 1 }) });
    if (made.status !== 201) throw new Error(`key refused (${made.status}): ${JSON.stringify(made.body)}`);
    keyId = made.body.apiKey.id;
    const auth = { authorization: `Bearer ${made.body.key}` };
    const api = async (path, init = {}) => {
      const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...auth, ...(init.headers ?? {}) } });
      return { status: res.status, body: await res.json().catch(() => null) };
    };
    run.api = {};
    const single = new FormData();
    single.set("file", new File([await readFile(join(dir, "bail-101-depot-cheques.pdf"))], "bail-101-depot-cheques.pdf", { type: "application/pdf" }));
    single.set("check", "compliance");
    single.set("reference", "API-LAURIER-101");
    const one = await api("/api/v1/checks", { method: "POST", body: single });
    run.api.check = { status: one.status, id: one.body?.check?.id, first: one.body?.check?.state };
    let check = one.body?.check;
    for (let i = 0; i < 60 && check && !["done", "failed", "refused"].includes(check.state); i++) {
      await sleep(8000);
      check = (await api(`/api/v1/checks/${check.id}`)).body?.check;
    }
    run.api.check.final = check && { state: check.state, error: check.error, documentId: check.documentId, analysisId: check.analysisId, findings: check.report?.findings?.map((f) => ({ ruleId: f.ruleId, verdict: f.verdict })) };
    const lot = await api("/api/v1/batches", { method: "POST", body: await form(files, csv) });
    run.api.batch = { status: lot.status, id: lot.body?.batch?.id };
    const apiBatch = await follow(async () => (await api(`/api/v1/batches/${lot.body.batch.id}`)).body.batch);
    run.api.batch.final = { finishedAt: apiBatch.finishedAt, counts: apiBatch.counts, items: apiBatch.items.map((i) => ({ line: i.line, file: i.file, state: i.state, error: i.error, documentId: i.documentId, analysisId: i.analysisId })) };
    run.api.refusals = {
      noKey: (await fetch(`${BASE}/api/v1/checks/${check?.id ?? "x"}`)).status,
      wrongKey: (await fetch(`${BASE}/api/v1/batches/${lot.body.batch.id}`, { headers: { authorization: "Bearer yzk_000000000000_nope" } })).status,
    };
  } finally {
    if (keyId) run.api.keyRevoked = (await user.json(`/api/me/api-keys/${keyId}`, { method: "DELETE" })).status;
    const restore = previous === undefined ? { method: "DELETE", body: JSON.stringify(allowance) } : { method: "PUT", body: JSON.stringify({ ...allowance, value: previous }) };
    run.api.allowanceRestored = (await admin.json("/api/admin/settings", { ...restore, headers: { "content-type": "application/json" } })).status;
  }

  // 4. the reports: the signed PDF of every finished compliance check, French and English, then the verification
  run.reports = [];
  for (const item of finished.items.filter((i) => i.analysisId && i.documentId)) {
    const entry = { line: item.line, file: item.file, analysisId: item.analysisId };
    for (const lang of ["fr", "en"]) {
      const res = await user.call(`/api/documents/${item.documentId}/analyses/${item.analysisId}/report?format=pdf&lang=${lang}`);
      if (res.status === 200) {
        const bytes = Buffer.from(await res.arrayBuffer());
        entry[lang] = { status: 200, bytes: bytes.length, sha256: sha(bytes), headerSha256: res.headers.get("x-report-sha256") };
        if (lang === "fr") await writeFile(join(dir, `rapport-${item.line}-fr.pdf`), bytes);
      } else entry[lang] = { status: res.status, code: (await res.json().catch(() => ({}))).code };
    }
    run.reports.push(entry);
  }
  // 5. what each check came to, for the write-up (docs/demo-b2b.md): the Orazaka run, the Studio version and the verdicts
  const outcome = async (item) => {
    if (!item.analysisId || !item.documentId) return { state: item.state, error: item.error };
    const a = (await user.json(`/api/documents/${item.documentId}/analyses/${item.analysisId}`)).body?.analysis;
    const report = a?.report;
    const verdicts = report?.findings ? Object.fromEntries(["PASS", "FAIL", "INSUFFICIENT_EVIDENCE"].map((v) => [v, report.findings.filter((f) => f.verdict === v).length])) : null;
    return {
      state: item.state,
      runId: a?.runId,
      studio: a?.studio,
      studioVersion: a?.blueprintVersion,
      verdicts,
      failed: report?.findings?.filter((f) => f.verdict === "FAIL").map((f) => f.ruleId),
      signals: report?.signals?.map((x) => `${x.signalId} ${x.level}`),
    };
  };
  run.outcomes = { web: {}, api: {} };
  for (const item of finished.items) run.outcomes.web[item.line] = { file: item.file, ...(await outcome(item)) };
  for (const item of run.api.batch?.final?.items ?? []) run.outcomes.api[item.line] = { file: item.file, ...(await outcome(item)) };
  if (run.photo?.check?.analysisId) run.outcomes.photo = await outcome({ documentId: run.photo.documentId, analysisId: run.photo.check.analysisId, state: "done" });
  run.finishedAt = new Date().toISOString();
  await writeFile(join(dir, "run.json"), JSON.stringify(run, null, 2));
  log(`done: web batch ${run.web.batchId}, api batch ${run.api?.batch?.id}; ${dir}/run.json written`);
}

if (command === "fixtures") await writeFixtures();
else if (command === "run") await run();
else {
  console.error("usage: demo-b2b.mjs fixtures|run <dir>");
  process.exit(2);
}
