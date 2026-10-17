/**
 * The landing's living proof: the real journey on dev.yomizaka.com, recorded by `scripts/landing-journey.mjs` as the QA
 * member (the e-mail hidden), one clip per step — keep, check (a compliance check run by Orazaka during the recording),
 * find — on a phone and on a desktop. On the Krizaka media CDN under hashed, immutable names
 * (`site/products/yomizaka/tour/<device>-<step>.<hash>.<ext>`, a URL never changes content); a new recording is new
 * hashes here and the old files pruned. The page's CSP lets this one host serve images and media (next.config.mjs).
 */
/** The Krizaka media CDN — the one host the page's CSP lets serve images and media (next.config.mjs). */
export const MEDIA_CDN = "https://krizaka-assets.b-cdn.net";

export const TOUR_STEPS = ["keep", "check", "find"] as const;
export const TOUR_DEVICES = ["phone", "desktop"] as const;
export type TourStep = (typeof TOUR_STEPS)[number];
export type TourDevice = (typeof TOUR_DEVICES)[number];

const TOUR = `${MEDIA_CDN}/site/products/yomizaka/tour`;

/** Recorded 2026-10-17 on dev.yomizaka.com: the hashes of each file. */
const HASHES: Record<TourDevice, Record<TourStep, { webm: string; mp4: string; jpg: string }>> = {
  phone: {
    keep: { webm: "a5332f939c", mp4: "dd53c37f51", jpg: "7ef34ee210" },
    check: { webm: "0808f9cf5b", mp4: "d59a89862e", jpg: "8b2d6618d9" },
    find: { webm: "0fc5ece1b3", mp4: "c3d04863a5", jpg: "9e9b942a38" },
  },
  desktop: {
    keep: { webm: "b8908ef0aa", mp4: "7e00af6b18", jpg: "afee43e365" },
    check: { webm: "67f5f38c8a", mp4: "9fb6a46c67", jpg: "d138e36ced" },
    find: { webm: "52ced24695", mp4: "69033ab33b", jpg: "5bfcf4cca5" },
  },
};

/** The Orazaka run each recorded check started (compliance-check, Québec residential lease): the proof the clip is real. */
export const TOUR_RUNS: Record<TourDevice, string> = {
  phone: "360c5e79-3f43-4f82-a96c-1067b3018d7c",
  desktop: "214de69a-88fb-4697-920a-92714ac3f96a",
};

export function tourClip(device: TourDevice, step: TourStep): { webm: string; mp4: string; poster: string } {
  const h = HASHES[device][step];
  const name = `${TOUR}/${device}-${step}`;
  return { webm: `${name}.${h.webm}.webm`, mp4: `${name}.${h.mp4}.mp4`, poster: `${name}.${h.jpg}.jpg` };
}
