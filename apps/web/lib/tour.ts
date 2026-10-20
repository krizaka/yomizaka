/**
 * The landing's living proof: « Du fichier au constat » — the real journey on dev.yomizaka.com as ONE smooth take, phone
 * first (390×844 at 3×), recorded by `scripts/landing-take.mjs` as the QA member (the e-mail hidden), in each language:
 * the lease dropped → the check runs → the finding with its line lit → search. On the Krizaka media CDN under hashed,
 * immutable names (`site/products/yomizaka/tour/take-<locale>.<hash>.<ext>`, sent by `scripts/upload-take.mjs`); a new
 * recording is new hashes here. The page's CSP lets this one host serve images and media (next.config.mjs).
 */
export const MEDIA_CDN = "https://krizaka-assets.b-cdn.net";

export const TAKE_CHAPTERS = ["drop", "check", "finding", "search"] as const;
export type TakeChapter = (typeof TAKE_CHAPTERS)[number];
export const TAKE_LOCALES = ["en", "fr"] as const;
export type TakeLocale = (typeof TAKE_LOCALES)[number];

const TOUR = `${MEDIA_CDN}/site/products/yomizaka/tour`;

/** Recorded 2026-10-19 on dev.yomizaka.com (25+ fps, 780×1688 — a CDP capture, scripts/landing-take.mjs): the hashes of each file, the Orazaka run the check started, the chapters' times (s). */
const TAKES: Record<TakeLocale, { files: { webm: string; mp4: string; jpg: string }; runId: string; seconds: number; fps: number; chapters: Record<TakeChapter, number> }> = {
  fr: { files: { webm: "8d9b5e341a", mp4: "95ae22b711", jpg: "297eb0e4db" }, runId: "90cb373b-1de8-4d01-9cd3-5652828313a3", seconds: 18.4, fps: 25.9, chapters: { drop: 1.4, check: 4.19, finding: 8.79, search: 14.26 } },
  en: { files: { webm: "0f56c7e720", mp4: "b78666614d", jpg: "297eb0e4db" }, runId: "3d76d3a3-dd7f-4557-aed2-bde1c9cb75f4", seconds: 18.2, fps: 25.2, chapters: { drop: 1.4, check: 4.78, finding: 8.71, search: 14.13 } },
};

/** The take of a language: its video (WebM and MP4), its poster, the run id that proves it is real, and where each chapter starts. */
export function takeFor(locale: TakeLocale): { webm: string; mp4: string; poster: string; runId: string; seconds: number; fps: number; chapters: Record<TakeChapter, number> } {
  const t = TAKES[locale];
  const name = `${TOUR}/take-${locale}`;
  return { webm: `${name}.${t.files.webm}.webm`, mp4: `${name}.${t.files.mp4}.mp4`, poster: `${name}.${t.files.jpg}.jpg`, runId: t.runId, seconds: t.seconds, fps: t.fps, chapters: t.chapters };
}
