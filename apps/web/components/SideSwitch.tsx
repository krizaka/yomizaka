import { cn } from "@krizaka/ui/cn";
import { type Perspective, PERSPECTIVES } from "@yomizaka/core";
import Link from "next/link";

import { type Locale } from "@/lib/i18n";
import { sidePath } from "@/lib/sides";

/**
 * « Je suis locataire / Je suis propriétaire »: a segmented control above the hero — one control, two addresses (the URL is
 * the state, the pages are static and indexable). On the home neither side is current; on a side's page it is.
 */
export function SideSwitch({ locale, current = null, label, hint, words }: { locale: Locale; current?: Perspective | null; label: string; hint: string; words: Record<Perspective, string> }) {
  return (
    <div className="mx-auto flex max-w-(--kz-page-max,72rem) flex-wrap items-center justify-center gap-3 px-(--kz-page-gutter,1rem) pt-24 md:justify-start" data-testid="side-switch">
      <span className="text-sm font-semibold text-fg-secondary">{hint}</span>
      <nav aria-label={label} className="inline-flex rounded-full border border-border-strong bg-surface-1 p-1 shadow-sm">
        {PERSPECTIVES.map((side) => (
          <Link
            key={side}
            href={sidePath(locale, side)}
            aria-current={current === side ? "page" : undefined}
            className={cn("rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:px-5", current === side ? "bg-accent text-on-accent shadow-sm" : "text-fg-secondary hover:bg-surface-2 hover:text-fg")}
          >
            {words[side]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
