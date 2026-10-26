/** The message key of a countable thing: `<base>One` for one, `<base>Many` otherwise (`organisation.filesOne`, `organisation.filesMany`). */
export const pluralKey = (base: string, count: number): string => `${base}${count === 1 ? "One" : "Many"}`;

/** The same, read from a dictionary slice (a server component's `t`), with `{count}` filled in. */
export function countLabel(messages: Readonly<Record<string, unknown>>, base: string, count: number): string {
  const message = messages[pluralKey(base, count)];
  return (typeof message === "string" ? message : "").replace("{count}", String(count));
}
