/**
 * The runs of a text in order, each with the offset where it starts: a key that stays the same as long as the text does
 * (a run is never empty, so no two share an offset), unlike its index.
 */
export function atOffsets<T extends { text: string }>(parts: readonly T[]): (T & { at: number })[] {
  let at = 0;
  return parts.map((part) => {
    const keyed = { ...part, at };
    at += part.text.length;
    return keyed;
  });
}

/** Rows read as `[label, value]`, each with a key made of its label and its rank among the rows of the same label. */
export function keyedByLabel<V>(rows: readonly (readonly [string, V])[]): { key: string; label: string; value: V }[] {
  const seen = new Map<string, number>();
  return rows.map(([label, value]) => {
    const rank = seen.get(label) ?? 0;
    seen.set(label, rank + 1);
    return { key: `${label}#${rank}`, label, value };
  });
}
