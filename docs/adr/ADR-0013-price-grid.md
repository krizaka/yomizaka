# ADR-0013: The price grid of the B2B pilot

- Status: accepted (2026-10-29, the CTO, a decision the founder delegated: « définis les prix avec notre audit ; on essaie
  d'être concurrentiel et on ajuste »)
- Issues: yomizaka#388 (the public page), #360 (the volume line), #133 (per-check billing, later), krizaka/.github#269
- Builds on: ADR-0004 (payments port), ADR-009 of krizaka/.github (prices are catalogue data the administrator schedules)

## Context

Two grids were on record and neither fit. The first one (2026-10-21) had 9,99 $ per audit and Pro at 29 $ a month: Pro cost
less than three single checks, so the single price only paid for the first two documents and the plan read as a consumer app.
The catalogue's seed (from the pricing audit) had 0,65 $ per document, 59 $ a month for 100 and 279 $ a month for 750. It was
benchmarked against identity-verification APIs, which Yomizaka is not (it verifies documents and screens files, it never
verifies identities). Next to what a landlord pays to screen an applicant, 0,65 $ reads as a toy price, and 279 $ is a big
first ticket for a pilot.

What a landlord or a manager pays today in Québec and Canada to screen one applicant (public prices, read 2026-10-29):

| Offer | Price (CAD, plus taxes) | Source |
|---|---|---|
| SingleKey tenant report, one credit bureau | 29,99 $ a report, no subscription | [singlekey.com](https://www.singlekey.com/en/knowledge-base/tenant-report-faqs/what-is-the-cost-of-the-tenant-report) |
| SingleKey, both bureaus | 44,99 $ a report | [singlekey.com](https://www.singlekey.com/en/knowledge-base/%25f0%259f%2592%25bc-singlekey-pricing-breakdown-know-what-youre-paying-for) |
| FrontLobby credit report | 10,99 $ (Premium member) to 18,99 $ (Basic) | [help.frontlobby.com](https://help.frontlobby.com/what-do-frontlobby-credit-reports-cost-in-canada) |
| CORPIQ ProprioEnquête | members only, prices not published | [corpiq.com](https://www.corpiq.com/en/services/62-pre-rental-screenings.html) |
| Document-fraud tools for property managers (pay stubs, bank statements) | per applicant or per document, on quote only | e.g. Snappt, Ocrolus Detect ([docs.ocrolus.com](https://docs.ocrolus.com/docs/product-sku-core)) |

None of the public offers examines the documents themselves (a pay stub as a file, a lease against the Civil Code); the ones
that do sell to managers on quote. A Yomizaka check is an add-on to a credit report, not a replacement: an applicant's file is
about three documents (a lease or offer, two pay stubs).

## Decision

Prices in CAD, **before taxes**: GST 5 % and QST 9,975 % are added on the invoice by the processor (Stripe Tax, ADR-0004), as
the page already says. Monthly only, cancel any time, no annual commitment, no setup fee.

| Plan (catalogue key) | Price | Includes |
|---|---|---|
| One document (`yomizaka.document`) | **4,99 $** per document | one verification, no subscription |
| Agency (`yomizaka.agency`) | **49 $** a month | 100 verifications a month |
| Building manager (`yomizaka.firm`) | **149 $** a month | 500 verifications a month |
| More than 500 a month | on quote | a line to the contact form, no figure |

- **The free trial is the first verification, once per account** (the `audit.freeFirst` setting, already enforced). No timed
  trial: the code has none, and a pilot account gets the same rule. A pilot price, if one is ever needed, is a catalogue entry
  scheduled by the administrator, never a code path.
- **Past the included volume** the account waits until next month (429 `FAIR_USE`): the code bills no usage (#373), so no
  overage figure exists anywhere, and the page says so.
- **What is not built stays « soon » with no figure**: the full applicant file, background checks, the filter alone.
- **The dedicated API** stays an internal entry (never on a public page).

Why these numbers:

- **4,99 $ a document** lets a landlord check one applicant's three documents for about 15 $, half of a single-bureau
  credit report, so it adds to the file instead of competing with it. It is the price the « landlord buys one check » path needs.
- **Agency at 49 $ for 100** pays for itself from the 10th document of the month (about three applicants): the line between an
  occasional landlord and an agency. Below 0,50 $ a verification, it is far under the per-applicant prices above.
- **Building manager at 149 $ for 500** is the step for a manager of several buildings (0,30 $ a verification), a first ticket a
  pilot can say yes to, where 279 $ was not.
- The rules are guarded by `apps/web/lib/pricing.test.ts`: one document is sold without a subscription,
  `9 × document < Agency ≤ 10 × document`, and each step includes more for less per verification.

## How we adjust

The grid is data: the administrator schedules a new price or volume from a date (`/config/prices`), audited; a subscription
keeps the version it was sold at. A changed amount needs its processor price under a new lookup key (this grid is `*_pilot_cad`
in `deploy/payments-catalogue.json`; `pnpm payments:setup` creates them), or the checkout refuses (503 `PRICE_MISMATCH`).
We look again after the first ten paying accounts: how many move from single documents to Agency, and at which document.

## Consequences

- The product is « In development »: the page shows the prices and its action is sign-in; sign-up is closed and the processor
  is in test mode, so nothing is charged yet (krizaka/krizaka-com#468).
- Comparisons on a public page need the source and date of each competitor's figure (krizaka/.github#269); this record holds them.
