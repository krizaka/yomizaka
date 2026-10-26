import { formatMoney } from "@krizaka/intl/money";

const TAG = { en: "en-CA", fr: "fr-CA" } as const;

/** A catalogue amount for display, from its integer cents, in the page's language (« 0,65 $ », « $0.65 »): every price is CAD, before taxes. */
export const money = (cents: number, locale: keyof typeof TAG): string => formatMoney(cents, { currency: "CAD", locale: TAG[locale], display: "narrowSymbol" });
