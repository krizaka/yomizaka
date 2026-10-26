import { TagChip } from "@krizaka/ui/chip";

import type { TagColor } from "@/lib/organisation/rules";

/** The tags of an item, read only: the name beside its marker of the closed palette (never colour alone). */
export function TagChips({ tags }: Readonly<{ tags: { id: string; name: string; color: TagColor }[] }>) {
  if (!tags.length) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {tags.map((t) => (
        <li key={t.id}>
          <TagChip marker={t.color} size="sm">
            {t.name}
          </TagChip>
        </li>
      ))}
    </ul>
  );
}
