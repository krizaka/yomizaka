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

/** Recorded 2026-10-17 on dev.yomizaka.com: the hashes of each file, the Orazaka run the check started, the chapters' times (s). */
const TAKES: Record<TakeLocale, { files: { webm: string; mp4: string; jpg: string }; runId: string; seconds: number; chapters: Record<TakeChapter, number> }> = {
  fr: { files: { webm: "03fffa406b", mp4: "112aa3ee60", jpg: "2d7438e38c" }, runId: "6265d3ec-6233-4646-8146-505d74b81cca", seconds: 18.1, chapters: { drop: 1.4, check: 4.29, finding: 8.44, search: 13.98 } },
  en: { files: { webm: "9375be29e7", mp4: "02713c0f1a", jpg: "933de0c312" }, runId: "b46a8dc3-2226-4444-8fc3-1dd7464ade1a", seconds: 18.4, chapters: { drop: 1.4, check: 4, finding: 8.6, search: 14.24 } },
};

/** The take of a language: its video (WebM and MP4), its poster, the run id that proves it is real, and where each chapter starts. */
export function takeFor(locale: TakeLocale): { webm: string; mp4: string; poster: string; runId: string; seconds: number; chapters: Record<TakeChapter, number> } {
  const t = TAKES[locale];
  const name = `${TOUR}/take-${locale}`;
  return { webm: `${name}.${t.files.webm}.webm`, mp4: `${name}.${t.files.mp4}.mp4`, poster: `${name}.${t.files.jpg}.jpg`, runId: t.runId, seconds: t.seconds, chapters: t.chapters };
}
