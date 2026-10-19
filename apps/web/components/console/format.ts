/** Sizes and dates as the person's language writes them. */
const INTL: Record<"en" | "fr", string> = { en: "en-CA", fr: "fr-CA" };
/** The server and the browser both draw a date: one time zone (the product's, Montréal) so they write the same text. */
export const DISPLAY_TIME_ZONE = "America/Toronto";

export function formatBytes(bytes: number, locale: "en" | "fr"): string {
  const units = ["B", "kB", "MB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)} ${units[unit]}`;
}

export function formatDate(iso: string | null | undefined, locale: "en" | "fr", withTime = false): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(INTL[locale], withTime ? { dateStyle: "medium", timeStyle: "short", timeZone: DISPLAY_TIME_ZONE } : { dateStyle: "medium", timeZone: DISPLAY_TIME_ZONE });
}
