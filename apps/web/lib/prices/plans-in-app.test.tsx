import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PricingContent } from "@/components/pricing/PricingContent";
import { CONSOLE_ROUTES } from "@/lib/console-nav";
import { getDictionary } from "@/lib/i18n";
import { PRICE, soldKindOfPlan } from "@/lib/pricing";

/** krizaka-internal#1901: a signed-in user is shown the grid with « Subscribe », never the public page's « Sign in ». */
const SOLD = [
  { plan: PRICE.document, price: "$9.99", per: "dossier" as const, included: null, overage: null },
  { plan: PRICE.agency, price: "$49", per: "month" as const, included: 25, overage: "$2" },
];

describe("the in-app plans page", () => {
  it("lives under the app and the home's plan line leads to it", () => {
    expect(CONSOLE_ROUTES.plans).toBe("/app/plans");
  });

  it("maps a catalogue entry to the kind the checkout sells", () => {
    expect(soldKindOfPlan(PRICE.agency)).toBe("agency");
    expect(soldKindOfPlan(PRICE.document)).toBe("document");
    expect(soldKindOfPlan("internal")).toBeUndefined();
  });

  it("shows the action it is given on every plan, with the free monthly dossier, and no « Sign in »", () => {
    const html = renderToStaticMarkup(
      <PricingContent
        locale="en"
        sold={SOLD}
        soon={[]}
        freeFirst
        status="In development"
        action={(plan) => <button type="button">{`Subscribe — ${plan}`}</button>}
      />,
    );
    const dict = getDictionary("en");
    expect(html).toContain(`Subscribe — ${PRICE.agency}`);
    expect(html).toContain(dict.pricing.freeFirst);
    expect(html).not.toContain(dict.chrome.signIn);
  });

  it("keeps « Sign in » on the public page", () => {
    const html = renderToStaticMarkup(
      <PricingContent locale="en" sold={SOLD} soon={[]} freeFirst={false} status="In development" />,
    );
    expect(html).toContain(getDictionary("en").chrome.signIn);
  });
});
