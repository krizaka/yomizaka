/** A QST registration number: ten digits, "TQ", four digits (e.g. 1234567890TQ0001). */
const QST_NUMBER = /^\d{10}TQ\d{4}$/;

/** The number as printed on a document ("1234 567 890 TQ 0001", dashes, lower case) reduced to its compact form; null when it is not a QST number. Checked before any call. */
export function normaliseQstNumber(printed: string): string | null {
  const compact = printed.replaceAll(/[\s\-.]/g, "").toUpperCase();
  return QST_NUMBER.test(compact) ? compact : null;
}
