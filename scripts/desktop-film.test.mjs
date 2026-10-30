import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { describe, it } from "vitest";

import { cropRect, createFilm, FILM_SIZE, joinArgs, MIN_SIDE, screencaptureArgs, windowRect } from "./desktop-film-lib.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("the crop of the Mac film", () => {
  it("is the window alone, whole numbers, even sides, never off the screen", () => {
    assert.deepEqual(cropRect({ x: 120.4, y: 60.6, width: 1201, height: 799 }), { x: 120, y: 61, width: 1200, height: 798 });
    assert.deepEqual(cropRect({ x: -8, y: -3, width: 1000, height: 700 }), { x: 0, y: 0, width: 1000, height: 700 });
  });
  it("refuses a window that is not shown yet or a rectangle that is not known (no film of the desktop)", () => {
    assert.throws(() => cropRect({ x: 0, y: 0, width: MIN_SIDE - 1, height: 800 }), /not shown yet/);
    assert.throws(() => cropRect(undefined), /unknown/);
    assert.throws(() => cropRect({ x: "a", y: 0, width: 900, height: 700 }), /unknown/);
  });
  it("films the screen with a ceiling and never passes -R (screencapture refuses -R with -v: run 41071237202 filmed nothing)", () => {
    assert.deepEqual(screencaptureArgs("t.mov", 25), ["-v", "-V", "25", "t.mov"]);
    assert.ok(!screencaptureArgs("t.mov").some((a) => a.startsWith("-R")));
  });
});

describe("the window of the app", () => {
  it("is the driver's rectangle when it answers", async () => {
    const driver = { rect: async () => ({ x: 100, y: 50, width: 1100, height: 760 }), run: async () => assert.fail("not needed") };
    assert.deepEqual(await windowRect(driver), { x: 100, y: 50, width: 1100, height: 760 });
  });
  it("is the page's own position when the driver has no rectangle, or a splash-sized one", async () => {
    const run = async () => [30, 40, 900, 700];
    assert.deepEqual(await windowRect({ rect: async () => Promise.reject(new Error("404")), run }), { x: 30, y: 40, width: 900, height: 700 });
    assert.deepEqual(await windowRect({ rect: async () => ({ x: 0, y: 0, width: 10, height: 10 }), run }), { x: 30, y: 40, width: 900, height: 700 });
  });
});

describe("the takes", () => {
  const fakeSpawn = (log) => (command, args) => {
    const child = new EventEmitter();
    child.kill = (signal) => {
      log.push(`kill ${signal}`);
      queueMicrotask(() => child.emit("exit", 0));
    };
    log.push(`${command} ${args.join(" ")}`);
    return child;
  };
  it("starts on the window after the stream is open, and stops (SIGINT) only when the take is over", async () => {
    const log = [];
    const waits = [];
    const saved = [];
    const film = createFilm({ dir: "out", spawnImpl: fakeSpawn(log), save: (f, t) => saved.push([f, t]), sleep: async (ms) => waits.push(ms) });
    await film.start({ x: 10, y: 20, width: 800, height: 600 });
    assert.deepEqual(log, ["screencapture -v -V 25 out/mac-take-1.mov"]);
    assert.deepEqual(saved, [["out/mac-take-1.crop", "10,20,800,600"]]);
    assert.equal(waits.length, 1);
    await film.stop();
    await film.stop();
    await film.start({ x: 0, y: 0, width: 640, height: 480 });
    await film.stop();
    assert.deepEqual(film.files, ["out/mac-take-1.mov", "out/mac-take-2.mov"]);
    assert.equal(log.filter((line) => line === "kill SIGINT").length, 2);
  });
  it("films nothing without a directory, and never the whole screen when the window is unknown", async () => {
    const log = [];
    const none = createFilm({ spawnImpl: fakeSpawn(log) });
    await none.start({ x: 0, y: 0, width: 800, height: 600 });
    await none.stop();
    assert.deepEqual(log, []);
    await assert.rejects(createFilm({ dir: "out", spawnImpl: fakeSpawn(log) }).start({}), /unknown/);
    assert.deepEqual(log, []);
  });
});

describe("the joined film", () => {
  it("is one mp4 of the takes in order, letterboxed to one size, silent", () => {
    const args = joinArgs(["a.mov", "b.mov", "c.mov"], "film.mp4");
    assert.deepEqual(args.filter((_, i) => args[i - 1] === "-i"), ["a.mov", "b.mov", "c.mov"]);
    const graph = args[args.indexOf("-filter_complex") + 1];
    assert.match(graph, new RegExp(`scale=${FILM_SIZE.width}:${FILM_SIZE.height}:force_original_aspect_ratio=decrease`));
    assert.match(graph, /\[v0\]\[v1\]\[v2\]concat=n=3:v=1:a=0\[v\]/);
    assert.ok(args.includes("-an") && args.at(-1) === "film.mp4");
    const cut = joinArgs(["a.mov"], "f.mp4", ["10,20,800,600"]);
    assert.match(cut[cut.indexOf("-filter_complex") + 1], /\[0:v\]crop=800:600:10:20,scale=/);
  });
});

describe("the journey films the window, after the sign-in, without the engine's wait", () => {
  it("starts a take on each screen worth reading and stops before the app quits", () => {
    const journey = read("./desktop-journey.mjs");
    const order = ["await signInIfAsked", "1-library", "await filmWindow()", "check-document", "await film.stop(); // the engine", "3-result", "await filmWindow()", "driver.quit()", "4-relaunch"];
    let at = -1;
    for (const needle of order) {
      const next = journey.indexOf(needle, at + 1);
      assert.ok(next > at, `${needle} comes after the previous step`);
      at = next;
    }
    assert.equal((journey.match(/film\.stop\(\)/g) ?? []).length >= 4, true);
  });
});

describe("the action's --film flag is one the journey accepts", () => {
  it("declares film among the parsed options (an unknown option stops the run, run 41064298492)", () => {
    assert.match(read("./desktop-journey.mjs"), /parseArgs\(\{ options: \{.*film: \{ type: "boolean"/);
  });
});
