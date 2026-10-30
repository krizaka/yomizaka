// The Mac film (yomizaka#636): the journey films only the app's window, from the first screen of the library (after the sign-in,
// so no address is ever typed in front of the camera), in short takes that skip the engine's wait, joined into one clip.
// This file holds the parts that can be checked without a Mac: the crop, the recorder's command, the takes, the join.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// @fixed: a window smaller than this is a window that is not shown yet (a splash), not a screen worth filming
export const MIN_SIDE = 200;
// @fixed: screencapture needs about a second to open its stream; the take waits so the first screen is in it
export const START_MS = 1200;
// @fixed: a take that is not asked to stop ends by itself (the film never runs on)
export const TAKE_MAX_S = 25;
// @fixed: the joined film is 1280 x 800, the app's window ratio, whatever the relaunch's window is
export const FILM_SIZE = { width: 1280, height: 800 };

/** The window as a crop: whole, even numbers (H.264 wants even sides), never off the screen's top-left. */
export function cropRect(rect) {
  const [x, y, w, h] = [rect?.x, rect?.y, rect?.width, rect?.height];
  if (![x, y, w, h].every(Number.isFinite))
    throw new Error(`the window's rectangle is unknown: ${JSON.stringify(rect)}`);
  if (w < MIN_SIDE || h < MIN_SIDE) throw new Error(`the window is ${w} x ${h}: not shown yet`);
  const even = (n) => Math.floor(n / 2) * 2;
  return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), width: even(w), height: even(h) };
}

/** The window of the app: the W3C rectangle when the driver answers, else the page's own screen position. */
export async function windowRect(driver) {
  const w3c = await driver.rect().catch(() => undefined);
  if (w3c && w3c.width >= MIN_SIDE && w3c.height >= MIN_SIDE) return cropRect(w3c);
  const [x, y, width, height] = await driver.run(
    "return [window.screenX, window.screenY, window.innerWidth, window.innerHeight]",
  );
  return cropRect({ x, y, width, height });
}

/**
 * `screencapture` as a video of the screen, at most `maxSeconds`, stopped earlier by SIGINT. `-R` is not accepted with `-v` (the first
 * run on the runner filmed nothing, run 41071237202): the window is cut out of the screen at the join, from the take's `.crop` file.
 */
export const screencaptureArgs = (file, maxSeconds = TAKE_MAX_S) => ["-v", "-V", String(maxSeconds), file];

/** The crop of a take, as the text of its `.crop` file: `x,y,width,height`. */
export const cropText = (rect) => `${rect.x},${rect.y},${rect.width},${rect.height}`;
const cropFilter = (text) => {
  const [x, y, w, h] = text.trim().split(",").map(Number);
  return `crop=${w}:${h}:${x}:${y},`;
};

/** The takes of a film: `start(rect)` opens a take on the window, `stop()` ends it; no directory, no film. */
export function createFilm({
  dir,
  spawnImpl = spawn,
  save = writeFileSync,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const files = [];
  let take;
  return {
    files,
    async start(rect) {
      if (!dir) return;
      const file = join(dir, `mac-take-${files.length + 1}.mov`);
      const crop = cropRect(rect);
      save(file.replace(/\.mov$/, ".crop"), cropText(crop));
      const child = spawnImpl("screencapture", screencaptureArgs(file), { stdio: "ignore" });
      const exited = new Promise((resolve) => child.once("exit", resolve));
      take = { child, exited };
      files.push(file);
      await sleep(START_MS);
    },
    async stop() {
      if (!take) return;
      const { child, exited } = take;
      take = undefined;
      child.kill("SIGINT");
      await exited;
    },
  };
}

/** `ffmpeg` arguments that join the takes into one mp4 of FILM_SIZE (letterboxed, never stretched). */
export function joinArgs(files, out, crops = []) {
  const { width, height } = FILM_SIZE;
  const fit = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`;
  const prepared = files.map((_, i) => `[${i}:v]${crops[i] ? cropFilter(crops[i]) : ""}${fit}[v${i}]`).join(";");
  const chain = files.map((_, i) => `[v${i}]`).join("");
  return [
    "-y",
    ...files.flatMap((file) => ["-i", file]),
    "-filter_complex",
    `${prepared};${chain}concat=n=${files.length}:v=1:a=0[v]`,
    "-map",
    "[v]",
    "-an",
    "-pix_fmt",
    "yuv420p",
    out,
  ];
}
