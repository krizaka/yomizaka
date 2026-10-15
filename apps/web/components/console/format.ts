/** Sizes and dates as the person's language writes them. */
const INTL: Record<"en" | "fr", string> = { en: "en-CA", fr: "fr-CA" };

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
  return new Date(iso).toLocaleString(INTL[locale], withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}
