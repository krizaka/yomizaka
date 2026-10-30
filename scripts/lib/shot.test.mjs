import assert from "node:assert/strict";
import { test } from "vitest";

import { presetTheme, themesOf } from "./recording-kit.mjs";
import { shoot, shotFile } from "./shot.mjs";

test("themesOf reads dark, light or both and refuses the rest", () => {
  assert.deepEqual(themesOf(), ["dark"]);
  assert.deepEqual(themesOf("light"), ["light"]);
  assert.deepEqual(themesOf("both"), ["dark", "light"]);
  assert.throws(() => themesOf("sepia"), /dark, light or both/);
});

test("presetTheme stores kz-theme and survives blocked storage", () => {
  const store = {};
  globalThis.localStorage = { setItem: (k, v) => (store[k] = v) };
  presetTheme("light");
  assert.equal(store["kz-theme"], "light");
  globalThis.localStorage = {
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.doesNotThrow(() => presetTheme("dark"));
  delete globalThis.localStorage;
});

test("shoot takes one file per theme, the theme set before the page loads", async () => {
  const log = [];
  const browser = {
    newContext: async (opts) => ({
      addInitScript: async (fn, arg) => log.push(["init", opts.colorScheme, arg]),
      newPage: async () => ({ screenshot: async ({ path }) => log.push(["shot", path]) }),
      close: async () => {},
    }),
  };
  const files = await shoot(browser, { dir: "/o", name: "g", open: async () => {} });
  assert.deepEqual(files, [shotFile("/o", "g", "dark"), shotFile("/o", "g", "light")]);
  assert.deepEqual(
    log.filter((l) => l[0] === "init"),
    [
      ["init", "dark", "dark"],
      ["init", "light", "light"],
    ],
  );
});
