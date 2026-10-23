import { Chip } from "@krizaka/ui/chip";

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
