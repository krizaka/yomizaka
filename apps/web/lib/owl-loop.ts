/**
 * The owl at work — its loop from the Krizaka flock (rendered from the code of @krizaka/ui by krizaka-ui
 * tools/brand-films): it reads a page line by line, then the check. On the Krizaka media CDN under hashed, immutable
 * names (site/brand-films/loops/, named by krizaka-com's lib/cdn-manifest.json); a new render is a new name, copied here.
 * The page's CSP lets this one host serve images and media (next.config.mjs).
 */
export const MEDIA_CDN = "https://krizaka-assets.b-cdn.net";

const LOOPS = `${MEDIA_CDN}/site/brand-films/loops`;
const HASHES = {
  dark: { mp4: "74b283937e", jpg: "0c97ff15d2" },
  light: { mp4: "8ac173f7b0", jpg: "f7035857dc" },
} as const;

export type LoopTheme = keyof typeof HASHES;

/** The square loop of the owl in a theme: the MP4 and its poster (the page read, the check given). */
export function owlLoop(theme: LoopTheme): { mp4: string; poster: string } {
  const h = HASHES[theme];
  return { mp4: `${LOOPS}/owl-square-${theme}.${h.mp4}.mp4`, poster: `${LOOPS}/owl-square-${theme}.${h.jpg}.jpg` };
}
