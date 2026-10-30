#!/usr/bin/env node
// Trims every film of a directory in place and checks its start: node scripts/film-trim.mjs <dir>
// (the web clips of the download page; the Mac film is trimmed as it is joined, scripts/desktop-film-lib.mjs)
import { spawnSync } from "node:child_process";
import { readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

import { assertStart, cutsOf, parseBlacks, parseFreezes, trimFilter } from "./film-trim-lib.mjs";

const dir = process.argv[2];
if (!dir) throw new Error("usage: film-trim.mjs <dir with .webm/.mp4 films>");
const ffmpeg = "ffmpeg";
const ffprobe = "ffprobe";
const run = (command, args) => spawnSync(command, args, { encoding: "utf8" }); // NOSONAR S4036: a CI step on a runner, PATH is the runner's own
const durationOf = (file) => Number(run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).stdout.trim());
const analyse = (file) => {
  const log = run(ffmpeg, ["-hide_banner", "-i", file, "-vf", "freezedetect=n=-50dB:d=0.4,blackdetect=d=0.2:pix_th=0.1", "-an", "-f", "null", "-"]).stderr;
  return { freezes: parseFreezes(log, durationOf(file)), blacks: parseBlacks(log) };
};

for (const name of readdirSync(dir).filter((n) => /\.(webm|mp4)$/.test(n))) {
  const file = join(dir, name);
  const filter = trimFilter(cutsOf(analyse(file)));
  if (filter) {
    const tmp = join(dir, `trim-${name}`);
    const done = run(ffmpeg, ["-y", "-i", file, "-vf", filter, "-an", tmp]);
    if (done.status !== 0) throw new Error(`cannot trim ${name}: ${done.stderr.slice(-300)}`);
    renameSync(tmp, file);
  }
  assertStart(analyse(file));
  console.log(`film-trim: ${name} ok`);
}
