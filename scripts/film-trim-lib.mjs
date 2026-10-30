// The trim of a film (web clips of the download page): it starts on the first meaningful frame and its idle stretches are cut, a
// still screen staying long enough to read. Pure parts: the parsing of ffmpeg's freezedetect/blackdetect logs, the plan, the check.

// @fixed: a still screen is kept this long (readable), the rest of the wait is cut
export const HOLD_S = 1.2;
// @fixed: a freeze shorter than this is a pause to read, not an idle stretch
export const IDLE_S = 1.5;
// @fixed: the start of a film is its first seconds; an idle or blank start longer than this fails the check
export const START_S = 1.5;

/** The freezes `[ {start, end} ]` a freezedetect log reports (a freeze still open at the end runs to `duration`). */
export function parseFreezes(log, duration) {
  const out = [];
  let open;
  for (const line of log.split("\n")) {
    const start = /freeze_start: ([\d.]+)/.exec(line);
    const end = /freeze_end: ([\d.]+)/.exec(line);
    if (start) open = Number(start[1]);
    else if (end && open !== undefined) {
      out.push({ start: open, end: Number(end[1]) });
      open = undefined;
    }
  }
  if (open !== undefined) out.push({ start: open, end: duration });
  return out;
}

/** The blacks `[ {start, end} ]` a blackdetect log reports. */
export function parseBlacks(log) {
  return [...log.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => ({
    start: Number(m[1]),
    end: Number(m[2]),
  }));
}

/**
 * What to cut: a freeze at the very start goes whole (the film opens on the first change), a freeze elsewhere longer than IDLE_S
 * keeps its first HOLD_S, a blank start goes. Returns the ranges `[from, to]` to drop, in seconds.
 */
export function cutsOf({ freezes, blacks = [] }) {
  const cuts = [];
  for (const b of blacks) if (b.start < 0.1) cuts.push([0, b.end]);
  for (const f of freezes) {
    if (f.start < 0.1) cuts.push([0, f.end]);
    else if (f.end - f.start > IDLE_S) cuts.push([f.start + HOLD_S, f.end]);
  }
  return cuts.sort((a, b) => a[0] - b[0]);
}

/** The ffmpeg video filter that drops those ranges and closes the gaps; null when there is nothing to cut. */
export function trimFilter(cuts) {
  if (cuts.length === 0) return null;
  const drop = cuts.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join("+");
  return `select='not(${drop})',setpts=N/FRAME_RATE/TB`;
}

/** Fails when the film opens blank or idle: a freeze or a black from its first frame lasting more than START_S. */
export function assertStart({ freezes, blacks = [] }) {
  const idle = [...freezes, ...blacks].find((r) => r.start < 0.1 && r.end - r.start > START_S);
  if (idle)
    throw new Error(
      `the film opens idle or blank for ${(idle.end - idle.start).toFixed(1)} s: it must start on its first meaningful frame`,
    );
}
