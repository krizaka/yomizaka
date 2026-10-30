import { formatMoney } from "@krizaka/intl/money";

const TAG = { en: "en-CA", fr: "fr-CA" } as const;

/** A catalogue amount for display, from its integer cents, in the page's language (« 0,65 $ », « $0.65 »): every price is CAD, before taxes. */
export const money = (cents: number, locale: keyof typeof TAG): string =>
  formatMoney(cents, { currency: "CAD", locale: TAG[locale], display: "narrowSymbol" });

/** A date for display (« October 29, 2026 », « 29 octobre 2026 »), in Québec's day. */
export const longDate = (date: Date, locale: keyof typeof TAG): string =>
  new Intl.DateTimeFormat(TAG[locale], { dateStyle: "long", timeZone: "America/Toronto" }).format(date);

/** The BCP 47 tag of a locale for the admin's amounts and dates (« fr-CA »). */
export const localeTag = (locale: keyof typeof TAG): string => TAG[locale];
