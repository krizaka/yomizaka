// One still, taken in every theme: `--theme both` (the default for shots) writes <name>-dark.png and <name>-light.png.
import path from "node:path";

import { applyTheme, themesOf } from "./recording-kit.mjs";

/** The file a shot of `name` in `theme` is written to. */
export const shotFile = (dir, name, theme) => path.join(dir, `${name}-${theme}.png`);

/**
 * Takes `name` once per theme. `open(page)` brings the page to the state to shoot.
 * Each theme gets its own context, with the theme set before the page loads.
 */
export async function shoot(browser, { dir, name, theme = "both", context = {}, open }) {
  const files = [];
  for (const t of themesOf(theme)) {
    const ctx = await browser.newContext({ ...context, colorScheme: t });
    await applyTheme(ctx, t);
    const page = await ctx.newPage();
    await open(page);
    const file = shotFile(dir, name, t);
    await page.screenshot({ path: file });
    await ctx.close();
    files.push(file);
  }
  return files;
}
