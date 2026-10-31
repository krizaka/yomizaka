// Who signs in, and how: the seeded persona, once per worker (the kit reuses the browser state after the first sign-in).
import { tmpdir } from "node:os";
import { join } from "node:path";

import { personaSessions, seededPersona } from "@krizaka/page-audit/journey";

export const BASE = process.env.VISUAL_BASE_URL ?? "http://localhost:3000";
// CI-only credentials of the seeded cast (scripts/ci-visual-start.sh), never a real account.
const CAST = {
  eric: {
    email: process.env.E2E_EMAIL ?? "eric@demo.yomizaka.test",
    password: process.env.E2E_PASSWORD ?? "ci-only-demo-password-0123",
  },
  // The cast's Camille holds no document and no dossier: a person on their first day (the local cast secret of a CI database).
  camille: {
    email: process.env.E2E_CAMILLE_EMAIL ?? "camille@demo.yomizaka.test",
    password: process.env.E2E_CAMILLE_PASSWORD ?? "local-cast-password-0123",
  },
};

/** Signs the persona in through the form, as a person would, and keeps the browser state in `file`. */
export function sessionsFor(browser, workerIndex) {
  return personaSessions({
    dir: join(tmpdir(), "yomizaka-journeys"),
    worker: workerIndex,
    async signIn(id, file) {
      const who = seededPersona(CAST, id);
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(new URL("/fr/sign-in", BASE).toString());
      await page.locator("input[type=email]").first().fill(who.email);
      await page.locator("input[type=password]").first().fill(who.password);
      await page.locator("form button[type=submit]").first().click();
      await page.waitForURL(/\/app(\/|\?|$)/, { timeout: 60_000 });
      await context.storageState({ path: file });
      await context.close();
    },
  });
}

/** The two screens the journeys run on: the first screen of each is the promise (desktop films, the phone is checked as is). */
export const SCREENS = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 } },
];

/** A page of `persona` on `screen`, signed in, at `path`; the desktop one is filmed when the journey says so. */
export async function openAs({ browser, info, persona, screen, journey, videoContextOptions, path }) {
  const state = await sessionsFor(browser, info.workerIndex).stateFor(persona);
  const context = await browser.newContext({
    storageState: state,
    viewport: screen.viewport,
    ...(screen.name === "desktop" ? videoContextOptions(journey, { dir: info.outputDir }) : {}),
  });
  const page = await context.newPage();
  await page.goto(new URL(path, BASE).toString());
  return page;
}
