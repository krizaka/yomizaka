// Journey « upgrade-from-home » (journeys.json; krizaka-internal#1901): Eric, signed in, goes from the home's plan line to the in-app
// plans (one step, the app's shell kept, no « Sign in »), chooses Agency and the checkout starts. The hosted payment page is the
// processor's: the checkout request is answered here with a test-mode hosted address, and the real test-mode purchase is the
// checkout journey's (scripts/checkout-journey.mjs, Stripe TEST card).
import { expect, test } from "@playwright/test";

import { BASE, sessionsFor } from "./session.mjs";

test("Eric reaches the plans from the home in one step and starts the Agency checkout", async ({ browser }, info) => {
  const state = await sessionsFor(browser, info.workerIndex).stateFor("eric");
  const context = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const hosted = "https://checkout.stripe.com/c/pay/cs_test_journey";
  let asked = null;
  await page.route("**/api/billing/checkout", async (route) => {
    asked = route.request().postDataJSON();
    await route.fulfill({ json: { url: hosted } });
  });
  await page.route(hosted, (route) => route.fulfill({ body: "hosted", contentType: "text/html" }));

  await page.goto(new URL("/fr/app", BASE).toString());
  await page.getByTestId("credits").getByRole("link").click();
  await expect(page, "one step from the home").toHaveURL(/\/fr\/app\/plans/);
  await expect(page.getByRole("navigation").first(), "the app's navigation is kept").toBeVisible();
  await expect(page.getByRole("link", { name: /Se connecter/ }), "no « Sign in » for a signed-in user").toHaveCount(0);

  await expect(page.getByTestId("plan-document"), "the one-document plan can be bought").toBeVisible();
  await page.getByTestId("plan-agency").click();
  await page.waitForURL(hosted, { timeout: 30_000 });
  expect(asked, "the checkout asked for the Agency plan").toEqual({ kind: "agency" });
});
