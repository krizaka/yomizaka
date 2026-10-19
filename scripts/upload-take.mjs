#!/usr/bin/env node
// Sends the landing take (scripts/landing-take.mjs output) to the media library under hashed, immutable names:
//   site/products/yomizaka/tour/take-<locale>.<sha256-10>.<ext>   (a URL never changes content)
// Credentials from the environment (MEDIA_STORAGE_API_KEY, MEDIA_STORAGE_ZONE, MEDIA_STORAGE_ENDPOINT), never printed.
// Prints the hashes to paste into apps/web/lib/tour.ts.
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const [dir, ...locales] = process.argv.slice(2);
const key = process.env.MEDIA_STORAGE_API_KEY;
const zone = process.env.MEDIA_STORAGE_ZONE;
const endpoint = process.env.MEDIA_STORAGE_ENDPOINT ?? "storage.bunnycdn.com";
if (!key || !zone) throw new Error("MEDIA_STORAGE_API_KEY and MEDIA_STORAGE_ZONE are required");
const TYPES = { webm: "video/webm", mp4: "video/mp4", jpg: "image/jpeg" };
const out = {};
for (const locale of locales) {
  const evidence = JSON.parse(readFileSync(path.join(dir, locale, "evidence.json"), "utf8"));
  out[locale] = { runId: evidence.runId, seconds: evidence.seconds, chapters: evidence.chapters, files: {} };
  for (const ext of Object.keys(TYPES)) {
    const body = readFileSync(path.join(dir, locale, `take.${ext}`));
    const hash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 10);
    const res = await fetch(`https://${endpoint}/${zone}/site/products/yomizaka/tour/take-${locale}.${hash}.${ext}`, { method: "PUT", headers: { AccessKey: key, "content-type": TYPES[ext] }, body });
    if (!res.ok) throw new Error(`upload ${locale}.${ext}: ${res.status}`);
    out[locale].files[ext] = hash;
  }
}
console.log(JSON.stringify(out, null, 2));
