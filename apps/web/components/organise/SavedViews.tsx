"use client";

import type { SavedView, SystemView, ViewFilters } from "@krizaka/organize/contract";
import { viewHref } from "@krizaka/organize/contract";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { ChipLink } from "@krizaka/ui/chip-link";
import { Dialog } from "@krizaka/ui/dialog";
import { DropdownMenu } from "@krizaka/ui/dropdown-menu";
import { createKrizakaForm } from "@krizaka/ui/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import type { ResolvedView } from "@/lib/workspace/view";

const nameForm = createKrizakaForm({ schema: z.object({ name: z.string().trim().min(1).max(80) }), defaultValues: { name: "" } });

/**
 * The saved views of a list: the system's, then the person's (a bar on a wide screen, one menu on a phone), and « Enregistrer la
 * vue » for the filters of the address. Every view is a link: the address is the state.
 * TODO(krizaka-ui#627): delete this wrapper the day FilterBar carries saved views; the props stay.
 */
export function SavedViews({ path, system, mine, resolved, kind }: { path: string; system: readonly SystemView[]; mine: readonly SavedView[]; resolved: ResolvedView; kind: string }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const filters: ViewFilters = resolved.filters;
  const entries = [
    ...system.map((v) => ({ id: v.key, label: v.label[locale], filters: v.filters, mine: false })),
    ...mine.map((v) => ({ id: v.id, label: v.name, filters: v.filters, mine: true })),
  ];
  const activeId = resolved.active?.id ?? null;
  const save = useMutation({ mutationFn: (viewName: string) => krizakaFetch(`/api/organize/${kind}/views`, { method: "POST", json: { name: viewName, filters } }) });
  const remove = useMutation({ mutationFn: (id: string) => krizakaFetch(`/api/organize/${kind}/views/${id}`, { method: "DELETE" }) });
  const canSave = Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
  const form = nameForm.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: (values) => create(values.name),
  });
  const create = async (name: string) => {
    setProblem(null);
    try {
      const { view } = (await save.mutateAsync(name)) as { view: SavedView };
      setSaving(false);
      router.push(viewHref(path, view.filters, view.id));
    } catch (error) {
      setProblem(say(`errors.${errorKey(error)}`));
    }
  };
  const drop = async (id: string) => {
    await remove.mutateAsync(id).catch(() => undefined);
    router.push(path);
  };
  const current = entries.find((e) => e.id === activeId);
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="saved-views">
      <nav aria-label={say("dossiers.views.label")} className="hidden flex-wrap items-center gap-2 sm:flex">
        <ChipLink asChild size="sm" selected={!activeId && !canSave}>
          <Link href={path}>{say("dossiers.views.all")}</Link>
        </ChipLink>
        {entries.map((e) => (
          <ChipLink key={e.id} asChild size="sm" selected={e.id === activeId}>
            <Link href={viewHref(path, e.filters, e.id)} aria-current={e.id === activeId ? "page" : undefined}>
              {e.label}
              {e.id === activeId && resolved.modified ? ` · ${say("dossiers.views.modified")}` : ""}
            </Link>
          </ChipLink>
        ))}
      </nav>
      <div className="sm:hidden" data-testid="views-menu">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="secondary" size="md">
              {current ? current.label : say("dossiers.views.menu")}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start">
            <DropdownMenu.Item asChild>
              <Link href={path}>{say("dossiers.views.all")}</Link>
            </DropdownMenu.Item>
            {entries.map((e) => (
              <DropdownMenu.Item key={e.id} asChild>
                <Link href={viewHref(path, e.filters, e.id)}>{e.label}</Link>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
      {canSave ? (
        <Button variant="ghost" size="md" onClick={() => setSaving(true)}>
          {say("dossiers.views.save")}
        </Button>
      ) : null}
      {current?.mine ? (
        <Button variant="ghost" size="md" aria-label={say("dossiers.views.delete", { name: current.label })} onClick={() => void drop(current.id)}>
          {say("dossiers.views.delete", { name: current.label })}
        </Button>
      ) : null}
      {saving ? (
        <Dialog.Root open onOpenChange={setSaving}>
          <Dialog.Content closeLabel={say("organisation.cancel")}>
            <Dialog.Header>
              <Dialog.Title>{say("dossiers.views.saveTitle")}</Dialog.Title>
              <Dialog.Description>{say("dossiers.views.saveHint")}</Dialog.Description>
            </Dialog.Header>
            <Dialog.Body className="flex flex-col gap-4">
              <form.Form aria-label={say("dossiers.views.saveTitle")} className="flex flex-col gap-4">
                <form.TextField name="name" label={say("dossiers.views.name")} maxLength={80} />
                {problem ? <Alert tone="danger">{problem}</Alert> : null}
                <form.Submit size="md">{say("dossiers.views.create")}</form.Submit>
              </form.Form>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Root>
      ) : null}
    </div>
  );
}
