// Who signs in, and how: the seeded persona, once per worker (the kit reuses the browser state after the first sign-in).
import { tmpdir } from "node:os";
import { join } from "node:path";

import { personaSessions, seededPersona } from "@krizaka/page-audit/journey";

export const BASE = process.env.VISUAL_BASE_URL ?? "http://localhost:3000";
// CI-only credentials of the seeded cast (scripts/ci-visual-start.sh), never a real account.
const CAST = { eric: { email: process.env.E2E_EMAIL ?? "eric@demo.yomizaka.test", password: process.env.E2E_PASSWORD ?? "ci-only-demo-password-0123" } };

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
