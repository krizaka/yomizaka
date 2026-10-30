#!/usr/bin/env node
// Joins the takes of the Mac film (scripts/desktop-film-lib.mjs) into one mp4: node scripts/desktop-film-join.mjs <dir> <out.mp4>
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { joinArgs } from "./desktop-film-lib.mjs";

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error("usage: desktop-film-join.mjs <dir with mac-take-N.mov> <out.mp4>");
const takes = readdirSync(dir)
  .filter((name) => /^mac-take-\d+\.mov$/.test(name))
  .sort((a, b) => Number.parseInt(a.replace(/\D/g, ""), 10) - Number.parseInt(b.replace(/\D/g, ""), 10))
  .map((name) => join(dir, name));
if (takes.length === 0) throw new Error(`no take in ${dir}: the journey filmed nothing`);
const joinFilm = joinArgs(
  takes,
  out,
  takes.map((take) => readFileSync(take.replace(/\.mov$/, ".crop"), "utf8")),
);
const run = spawnSync("ffmpeg", joinFilm, { stdio: "inherit" }); // NOSONAR S4036: a CI step on a runner, PATH is the runner's own (ffmpeg from brew)
process.exit(run.status ?? 1);
