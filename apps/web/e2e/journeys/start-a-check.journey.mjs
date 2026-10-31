// Journey « start-a-check » (journeys.json; krizaka-internal#1899): Eric drops a document on « Vérifier un document », the question
// « Quel document ? » is in view at once (no scroll, even on a phone), he answers « Bail » and the report opens.
import { readFileSync } from "node:fs";

import { videoContextOptions } from "@krizaka/page-audit/journey";
import { expect, test } from "@playwright/test";

import { BASE, sessionsFor } from "./session.mjs";

const JOURNEY = JSON.parse(readFileSync(new URL("./journeys.json", import.meta.url), "utf8")).find(
  (j) => j.id === "start-a-check",
);
const SCREENS = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 } },
];

for (const screen of SCREENS) {
  test(`Eric drops a document, answers « Quel document ? » in view and reaches the report (${screen.name})`, async ({
    browser,
  }, info) => {
    const state = await sessionsFor(browser, info.workerIndex).stateFor("eric");
    const context = await browser.newContext({
      storageState: state,
      viewport: screen.viewport,
      ...(screen.name === "desktop" ? videoContextOptions(JOURNEY, { dir: info.outputDir }) : {}),
    });
    const page = await context.newPage();
    await page.goto(new URL("/fr/app/check", BASE).toString());

    const flow = page.getByTestId("check-flow");
    await expect(flow, "the four steps are shown before the drop").toBeVisible();
    // A text the engine cannot place: it asks which document it is.
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "papier.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Un papier sans titre, que Yomizaka ne reconnaît pas."),
      });

    const question = page.getByTestId("check-kind-question");
    await expect(question, "« Quel document ? » appears").toBeVisible({ timeout: 30_000 });
    await expect
      .poll(
        async () => {
          const box = await question.boundingBox();
          return Boolean(box && box.y >= 0 && box.y + box.height <= screen.viewport.height);
        },
        { message: "the question is on the screen" },
      )
      .toBe(true);

    await question.getByRole("radio", { name: /Bail/ }).click();
    await expect(page, "the report opens").toHaveURL(/\/app\/documents\/[^/]+\/rapport/, { timeout: 30_000 });
    await context.close();
  });
}
