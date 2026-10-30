#!/usr/bin/env node
// Joins the frames of the Mac film (scripts/desktop-film-lib.mjs) into one mp4: node scripts/desktop-film-join.mjs <dir> <out.mp4>
// Fails when the film holds too few frames: no clip is better than an empty one.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { assertFrames, FRAME_LIST, framesInList, joinArgs } from "./desktop-film-lib.mjs";

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error("usage: desktop-film-join.mjs <dir with film-frames.txt> <out.mp4>");
const list = join(dir, FRAME_LIST);
if (!existsSync(list)) throw new Error(`no ${FRAME_LIST} in ${dir}: the journey filmed nothing`);
assertFrames(framesInList(readFileSync(list, "utf8")));
const ffmpeg = "ffmpeg";
const run = spawnSync(ffmpeg, joinArgs(list, out), { stdio: "inherit" }); // NOSONAR S4036: a CI step on a runner, PATH is the runner's own (ffmpeg from brew)
process.exit(run.status ?? 1);
