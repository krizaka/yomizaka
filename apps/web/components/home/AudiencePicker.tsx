import { ChipLink } from "@krizaka/ui/chip-link";
import { type Audience, AUDIENCE_STATUS, AUDIENCES } from "@yomizaka/core";
import Link from "next/link";

import { type Locale } from "@/lib/i18n";
import { sidePath } from "@/lib/sides";

/**
 * « Pour qui ? » as a row of chips: one line that scrolls sideways with snap on a phone (tap targets of 44 px, the edges
 * fade, nothing wraps into a mess) and wraps on a wide screen. One static, indexable page per audience; « Autre » is the
 * generic home. An audience whose rules are not built says « bientôt » — offered, never claimed.
 *
 * Built from @krizaka/ui's `ChipLink`. A generic « chip scroller » block (the scroll-snap row with faded edges) belongs in
 * krizaka-ui — see krizaka/krizaka-ui issue « ChipRow ».
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
  const chip = "min-h-11 shrink-0 snap-start whitespace-nowrap px-4 text-sm font-semibold";
  return (
    <div className="flex w-full min-w-0 flex-col gap-2" data-testid="audience-picker">
      <span className="text-sm font-semibold text-fg-secondary">{hint}</span>
      <nav aria-label={label} className="-mx-(--kz-page-gutter,1rem) overflow-x-auto px-(--kz-page-gutter,1rem) pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:px-0 [mask-image:linear-gradient(to_right,#000_90%,transparent)] md:[mask-image:none]">
        <ul className="m-0 flex w-max list-none snap-x snap-mandatory gap-2 p-0 md:w-auto md:flex-wrap">
          {AUDIENCES.map((a) => (
            <li key={a} className="shrink-0">
              <ChipLink asChild selected={current === a} className={chip}>
                <Link href={sidePath(locale, a)}>
                  {words[a]}
                  {AUDIENCE_STATUS[a] === "soon" ? (
                    <span className="ms-2 rounded-full border border-current px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider opacity-80" data-testid={`soon-${a}`}>
                      {soon}
                    </span>
                  ) : null}
                </Link>
              </ChipLink>
            </li>
          ))}
          <li className="shrink-0">
            <ChipLink asChild className={chip}>
              <Link href={`/${locale}`} data-testid="audience-other">
                {other}
              </Link>
            </ChipLink>
          </li>
        </ul>
      </nav>
    </div>
  );
}
