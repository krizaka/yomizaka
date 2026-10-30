// The Mac film (yomizaka#636): the journey films only the app's window, from the first screen of the library (after the sign-in,
// so no address is ever typed in front of the camera), skipping the engine's wait. The frames come from INSIDE the app: the same
// WebDriver the journey drives takes a screenshot of the window at a steady rate. No screen recording, so no macOS permission
// (TCC) is needed on the runner (`screencapture -v` filmed nothing there, runs 41071237202 and 41124359521).
// This file holds the parts that can be checked without a Mac: the frame recorder, the frame list, the join.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// @fixed: ten frames a second reads as motion for a UI film and keeps the screenshots (about 100 ms each) in step
export const FPS = 10;
// @fixed: three seconds of film; fewer frames than this is a film that failed, never a clip to publish
export const MIN_FRAMES = 30;
// @fixed: the joined film is 1280 x 800, the app's window ratio, whatever the window is
export const FILM_SIZE = { width: 1280, height: 800 };
export const FRAMES_DIR = "frames";
export const FRAME_LIST = "film-frames.txt";

const frameName = (n) => `frame-${String(n).padStart(5, "0")}.png`;

/** Fails loudly when the film holds fewer frames than `min`: an empty film is an error, never a green job with no clip. */
export function assertFrames(count, min = MIN_FRAMES) {
  if (!Number.isInteger(count) || count < min) throw new Error(`the film holds ${count} frame(s), at least ${min} are needed: the journey filmed nothing`);
  return count;
}

/**
 * The ffmpeg concat list of the frames: each shows for the time until the next one, at most three intervals (the gap of a stopped
 * take, the engine's wait, is not played), the last one for one interval. `frames` = `[{ file, at }]`, `at` in milliseconds.
 */
export function frameList(frames, fps = FPS) {
  const interval = 1000 / fps;
  const seconds = (ms) => (Math.min(ms, 3 * interval) / 1000).toFixed(3);
  const lines = frames.flatMap((frame, i) => {
    const next = frames[i + 1];
    return [`file '${frame.file}'`, `duration ${seconds(next ? next.at - frame.at : interval)}`];
  });
  // the concat demuxer ignores the duration of the last file unless it is named again
  if (frames.length > 0) lines.push(`file '${frames.at(-1).file}'`);
  return `${lines.join("\n")}\n`;
}

/**
 * The recorder: `start()` takes a screenshot of the window every 1/FPS s (`shoot()` answers a base64 PNG) until `stop()`; no
 * directory, no film. A screenshot that fails is skipped (the count tells); `finish()` writes the frame list and throws when
 * there are fewer than MIN_FRAMES.
 */
export function createFilm({
  dir,
  shoot,
  fps = FPS,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  save = writeFileSync,
  makeDir = (path) => mkdirSync(path, { recursive: true }),
} = {}) {
  const frames = [];
  const origin = now();
  let running = false;
  let loop = Promise.resolve();
  const interval = 1000 / fps;
  async function run() {
    while (running) {
      const began = now();
      try {
        const png = await shoot();
        if (png) {
          const file = join(FRAMES_DIR, frameName(frames.length + 1));
          save(join(dir, file), Buffer.from(png, "base64"));
          frames.push({ file, at: began - origin });
        }
      } catch {
        // a screenshot the window could not give (a transition): the next one will do
      }
      await sleep(Math.max(0, interval - (now() - began)));
    }
  }
  return {
    frames,
    get count() {
      return frames.length;
    },
    start() {
      if (!dir || running) return;
      if (!shoot) throw new Error("the film needs a way to take a screenshot of the window");
      makeDir(join(dir, FRAMES_DIR));
      running = true;
      loop = run();
    },
    /** Resolves when the recording has ended (stopped or cancelled). */
    get done() {
      return loop;
    },
    /** Ends the recording at once without waiting for the frame in flight. */
    cancel() {
      running = false;
    },
    async stop() {
      running = false;
      await loop;
    },
    finish(min = MIN_FRAMES) {
      if (!dir) return 0;
      assertFrames(frames.length, min);
      save(join(dir, FRAME_LIST), frameList(frames, fps));
      return frames.length;
    },
  };
}

/** `ffmpeg` arguments that turn the frame list into one mp4 of FILM_SIZE (letterboxed, never stretched), silent. */
export function joinArgs(list, out) {
  const { width, height } = FILM_SIZE;
  const fit = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`;
  return ["-y", "-f", "concat", "-safe", "0", "-i", list, "-vf", fit, "-an", "-pix_fmt", "yuv420p", out];
}

/** The number of frames a frame list names (one `file` line per frame, the last one repeated for its duration). */
export const framesInList = (text) => Math.max(0, (text.match(/^file '/gm) ?? []).length - 1);
