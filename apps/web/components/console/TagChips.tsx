import { Chip } from "@krizaka/ui/chip";
import { ChipLink } from "@krizaka/ui/chip-link";
import Link from "next/link";

import type { TagColor } from "@/lib/organisation/rules";

/** A tag's colour is a name in the database; here it becomes a Krizaka UI token (never a hex). */
export const TAG_TOKEN: Record<TagColor, string> = {
  blue: "var(--kz-info)",
  green: "var(--kz-success)",
  amber: "var(--kz-warning)",
  red: "var(--kz-danger)",
  violet: "var(--kz-accent-2)",
  gray: "var(--kz-fg-muted)",
};

function Dot({ color }: { color: TagColor }) {
  return <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: TAG_TOKEN[color] }} />;
}

/** The tags of an item, read only. */
export function TagChips({ tags }: { tags: { id: string; name: string; color: TagColor }[] }) {
  if (!tags.length) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {tags.map((t) => (
        <li key={t.id}>
          <Chip size="sm" selected={false} className="gap-1.5">
            <Dot color={t.color} />
            {t.name}
          </Chip>
        </li>
      ))}
    </ul>
  );
}

/** A one-of filter of a view (the type, the state): each chip is a link; the chosen one is the URL's value, and choosing it again clears it. */
export function ValueFilter({ label, options, selected, hrefFor }: { label: string; options: { value: string; label: string }[]; selected: string | null; hrefFor: (value: string | null) => string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2" data-testid={`filter-${label.toLowerCase()}`}>
      <span className="text-sm text-fg-secondary">{label}</span>
      {options.map((o) => (
        <ChipLink key={o.value} asChild size="sm" selected={selected === o.value}>
          <Link href={hrefFor(selected === o.value ? null : o.value)}>{o.label}</Link>
        </ChipLink>
      ))}
    </nav>
  );
}

/** The tag filter of a view: each chip is a link, the selected ones are the URL's `?tags=` (the URL is the state). */
export function TagFilter({ tags, selected, hrefFor, label, clearLabel, clearHref }: { tags: { id: string; name: string; color: TagColor }[]; selected: string[]; hrefFor: (id: string) => string; label: string; clearLabel: string; clearHref: string }) {
  if (!tags.length) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2" data-testid="tag-filter">
      <span className="text-sm text-fg-secondary">{label}</span>
      {tags.map((t) => (
        <ChipLink key={t.id} asChild size="sm" selected={selected.includes(t.id)}>
          <Link href={hrefFor(t.id)} className="gap-1.5">
            <Dot color={t.color} />
            {t.name}
          </Link>
        </ChipLink>
      ))}
      {selected.length ? (
        <Link href={clearHref} className="text-sm text-fg-accent underline">
          {clearLabel}
        </Link>
      ) : null}
    </nav>
  );
}
