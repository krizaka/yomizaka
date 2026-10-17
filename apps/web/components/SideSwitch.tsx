import { Button } from "@krizaka/ui/button";
import { type Perspective, PERSPECTIVES } from "@yomizaka/core";
import Link from "next/link";

import { type Locale } from "@/lib/i18n";
import { sidePath } from "@/lib/sides";

/**
 * « Je suis locataire / Je suis propriétaire »: one control, two addresses (the URL is the state, the pages are static
 * and indexable). On the home neither side is current; on a side's page it is.
 */
export function SideSwitch({ locale, current = null, label, words }: { locale: Locale; current?: Perspective | null; label: string; words: Record<Perspective, string> }) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2" data-testid="side-switch">
      {PERSPECTIVES.map((side) => (
        <Button key={side} asChild variant={current === side ? "primary" : "secondary"} size="md" shape="cut">
          <Link href={sidePath(locale, side)} aria-current={current === side ? "page" : undefined}>
            {words[side]}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
