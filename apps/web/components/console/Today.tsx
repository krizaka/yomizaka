"use client";

import { localDay } from "@krizaka/intl";

import { useSay } from "@/lib/i18n-client";

import { DISPLAY_TIME_ZONE, INTL } from "./format";

/** Today's date, in words, on the right of a heading (B2): a `time` in the product's zone, so the server and the browser write the same text. */
export function Today({ now }: Readonly<{ now: string }>) {
  const { locale } = useSay();
  const today = new Date(now);
  return (
    <time
      dateTime={localDay(today, DISPLAY_TIME_ZONE)}
      className="text-sm font-medium tabular-nums text-fg-secondary"
      data-testid="today"
    >
      {new Intl.DateTimeFormat(INTL[locale], { dateStyle: "full", timeZone: DISPLAY_TIME_ZONE }).format(today)}
    </time>
  );
}
