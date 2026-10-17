import { cn } from "@krizaka/ui/cn";
import { type Audience, AUDIENCE_STATUS, AUDIENCES } from "@yomizaka/core";
import Link from "next/link";

import { type Locale } from "@/lib/i18n";
import { sidePath } from "@/lib/sides";

/**
 * « Pour qui ? »: the audiences as chips above the hero, plus « Autre » (the generic home). The URL is the state — one static,
 * indexable page per audience. An audience whose rules are not built yet says « bientôt »: it is offered, never claimed.
 */
export function AudiencePicker({
  locale,
  current = null,
  label,
  hint,
  words,
  soon,
  other,
}: {
  locale: Locale;
  current?: Audience | null;
  label: string;
  hint: string;
  words: Record<Audience, string>;
  soon: string;
  other: string;
}) {
  const chip = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="mx-auto flex max-w-(--kz-page-max,72rem) flex-wrap items-center justify-center gap-3 px-(--kz-page-gutter,1rem) pt-24 md:justify-start" data-testid="audience-picker">
      <span className="text-sm font-semibold text-fg-secondary">{hint}</span>
      <nav aria-label={label} className="flex flex-wrap gap-1 rounded-3xl border border-border-strong bg-surface-1 p-1 shadow-sm sm:rounded-full">
        {AUDIENCES.map((a) => (
          <Link key={a} href={sidePath(locale, a)} aria-current={current === a ? "page" : undefined} className={cn(chip, current === a ? "bg-accent text-on-accent shadow-sm" : "text-fg-secondary hover:bg-surface-2 hover:text-fg")}>
            {words[a]}
            {AUDIENCE_STATUS[a] === "soon" ? <span className="rounded-full border border-current px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider opacity-80" data-testid={`soon-${a}`}>{soon}</span> : null}
          </Link>
        ))}
        <Link href={`/${locale}`} className={cn(chip, "text-fg-secondary hover:bg-surface-2 hover:text-fg")} data-testid="audience-other">
          {other}
        </Link>
      </nav>
    </div>
  );
}
