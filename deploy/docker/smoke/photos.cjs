// The photo stack inside the built image (ADR-0010): the image library, the HEIC decoder and Tesseract (fra + eng, in a worker thread)
// must run in the production image — the build's file tracing cannot see a worker thread's requires, so this proves the Dockerfile
// carries them. Run by scripts/ci-container-smoke.sh with the fixtures of deploy/docker/smoke mounted at /smoke.
const path = require("node:path"), fs = require("node:fs"), os = require("node:os");
const root = "/app/node_modules/.pnpm";
const find = (prefix) => path.join(root, fs.readdirSync(root).find((d) => d.startsWith(prefix)), "node_modules");
const sharp = require(path.join(find("sharp@"), "sharp"));
const decode = require(path.join(find("heic-decode@"), "heic-decode"));
const { createWorker } = require(path.join(find("tesseract.js@"), "tesseract.js"));
(async () => {
  const t0 = Date.now();
  const jpg = fs.readFileSync("/smoke/page.jpg");
  const g = await sharp(jpg).rotate().grayscale().normalise().jpeg().toBuffer();
  const h = await decode({ buffer: fs.readFileSync("/smoke/page.heic") });
  console.log("sharp ok", g.length, "heic ok", h.width + "x" + h.height);
  const dir = path.join(os.tmpdir(), "t"); fs.mkdirSync(dir, { recursive: true });
  for (const l of ["fra", "eng"]) fs.copyFileSync(path.join(find("@tesseract.js-data+" + l), "@tesseract.js-data", l, "4.0.0_best_int", l + ".traineddata.gz"), path.join(dir, l + ".traineddata.gz"));
  const w = await createWorker(["fra", "eng"], 1, { langPath: dir, gzip: true, cacheMethod: "none" });
  const r = await w.recognize(g);
  if (!/BAIL DE LOGEMENT/.test(r.data.text) || r.data.confidence < 70) throw new Error("OCR read " + r.data.confidence + ": " + r.data.text.slice(0, 60));
  console.log("ocr", Math.round(r.data.confidence), JSON.stringify(r.data.text.slice(0, 70)), Date.now() - t0, "ms", Math.round(process.memoryUsage().rss / 1e6), "MB rss");
  await w.terminate();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
