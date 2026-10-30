// @fixed: the size of a kilobyte, a unit, not a setting
const KILO = 1024;

/** A file's size in the person's language, with the unit Intl names (`2,4 Mo`, `2.4 MB`, `12 ko`). */
export function sizeOf(bytes: number, locale: string): string {
  const [value, unit] =
    bytes >= KILO * KILO ? [bytes / (KILO * KILO), "megabyte"] : [Math.max(1, Math.round(bytes / KILO)), "kilobyte"];
  return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "short", maximumFractionDigits: 1 }).format(
    value,
  );
}
