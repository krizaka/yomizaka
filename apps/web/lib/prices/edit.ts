/**
 * The admin screen's draft of one catalogue entry (`/config/prices`): the amount typed in dollars (« 0,65 » or « 0.65 »; empty =
 * on quote), the availability, each limit, and the day the change applies from (none = now). Pure, so the screen and its test agree.
 */
export interface PriceFields {
  amountCents: number | null;
  availability: string;
  limits: Record<string, number>;
}
export interface PriceDraft {
  amount: string;
  availability: string;
  limits: Record<string, string>;
  /** `YYYY-MM-DD`, or null for « now ». */
  from: string | null;
}

const AMOUNT = /^\d{1,7}(?:[.,]\d{1,2})?$/;
const INTEGER = /^\d{1,9}$/;

/** Dollars as typed → integer cents; empty → null (on quote); anything else → undefined (refused). */
export function centsFrom(text: string): number | null | undefined {
  const t = text.trim();
  if (t === "") return null;
  if (!AMOUNT.test(t)) return undefined;
  const [whole, part = ""] = t.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(part.padEnd(2, "0"));
}

const dollars = (cents: number | null) =>
  cents === null ? "" : `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

export const draftOf = (e: PriceFields): PriceDraft => ({
  amount: dollars(e.amountCents),
  availability: e.availability,
  limits: Object.fromEntries(Object.entries(e.limits).map(([k, v]) => [k, String(v)])),
  from: null,
});

/** What changed, as the API's patch — or null when the draft is not valid (an amount or a limit that is not a number). */
export function patchOf(saved: PriceFields, draft: PriceDraft): Partial<PriceFields> | null {
  const amountCents = centsFrom(draft.amount);
  if (amountCents === undefined) return null;
  const limits: Record<string, number> = {};
  for (const [k, v] of Object.entries(draft.limits)) {
    if (!INTEGER.test(v.trim())) return null;
    limits[k] = Number(v.trim());
  }
  const patch: Partial<PriceFields> = {};
  if (amountCents !== saved.amountCents) patch.amountCents = amountCents;
  if (draft.availability !== saved.availability) patch.availability = draft.availability;
  if (Object.entries(limits).some(([k, v]) => saved.limits[k] !== v)) patch.limits = limits;
  return patch;
}

/** A day picked in the admin's calendar → the instant it starts, in the admin's own time zone (null: today, so « now »). */
export function effectiveFromOf(from: string | null, today: string): string | undefined {
  if (!from || from <= today) return undefined;
  return new Date(`${from}T00:00:00`).toISOString();
}
