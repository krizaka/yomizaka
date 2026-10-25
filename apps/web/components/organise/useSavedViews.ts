"use client";

import type { SavedView, SystemView, ViewFilters } from "@krizaka/organize/contract";
import { viewHref } from "@krizaka/organize/contract";
import { krizakaFetch, useMutation } from "@krizaka/query";
import type { SavedViewsProps } from "@krizaka/ui/filter-bar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { useSay } from "@/lib/i18n-client";
import type { ResolvedView } from "@/lib/workspace/view";

/**
 * The `views` of Krizaka UI's `FilterBar` (chips on a wide screen, one menu on a phone; save, rename, delete), bound to the workspace's
 * API and to the address: every view is a link, the address is the state. No markup of its own.
 */
export function useSavedViews({ path, system, mine, resolved, kind }: { path: string; system: readonly SystemView[]; mine: readonly SavedView[]; resolved: ResolvedView; kind: string }): SavedViewsProps {
  const { say, locale } = useSay();
  const router = useRouter();
  const filters: ViewFilters = resolved.filters;
  const activeId = resolved.active?.id ?? null;
  const views = useMemo(
    () => [
      ...system.map((v) => ({ id: v.key, label: v.label[locale], group: "system" as const, href: viewHref(path, v.filters, v.key) })),
      ...mine.map((v) => ({ id: v.id, label: v.name, group: "mine" as const, href: viewHref(path, v.filters, v.id) })),
    ],
    [system, mine, locale, path],
  );
  const save = useMutation({ mutationFn: (name: string) => krizakaFetch(`/api/organize/${kind}/views`, { method: "POST", json: { name, filters } }) });
  const rename = useMutation({ mutationFn: (v: { id: string; name: string }) => krizakaFetch(`/api/organize/${kind}/views/${v.id}`, { method: "PATCH", json: { name: v.name } }) });
  const remove = useMutation({ mutationFn: (id: string) => krizakaFetch(`/api/organize/${kind}/views/${id}`, { method: "DELETE" }) });
  const hasFilters = Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
  return {
    views,
    current: activeId,
    modified: resolved.modified || (!activeId && hasFilters),
    linkAs: Link,
    onSave: (name) =>
      void save.mutateAsync(name).then((answer) => {
        const { view } = answer as { view: SavedView };
        router.push(viewHref(path, view.filters, view.id));
      }),
    onRename: (id, name) => void rename.mutateAsync({ id, name }).then(() => router.refresh()),
    onDelete: (id) =>
      void remove.mutateAsync(id).then(() => {
        if (id === activeId) router.push(path);
        else router.refresh();
      }),
    labels: {
      views: say("dossiers.views.label"),
      groups: { system: say("dossiers.views.groups.system"), workspace: say("dossiers.views.groups.workspace"), mine: say("dossiers.views.mine") },
      menu: (current) => say("dossiers.views.menuCurrent", { current }),
      none: say("dossiers.views.all"),
      modified: say("dossiers.views.modified"),
      save: say("dossiers.views.save"),
      name: say("dossiers.views.name"),
      confirm: say("dossiers.views.create"),
      cancel: say("organisation.cancel"),
      rename: say("dossiers.views.rename"),
      remove: say("dossiers.views.remove"),
      actions: (label) => say("dossiers.views.actions", { label }),
    },
  };
}
