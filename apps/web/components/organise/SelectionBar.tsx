"use client";

import { movesFrom, type StatusSet } from "@krizaka/organize/contract";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { DropdownMenu } from "@krizaka/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import { pluralKey } from "@/lib/plural";
import { OWNER_ROLE } from "@/lib/workspace/decl";
import { press } from "@/lib/workspace/press";

import { TagChips } from "../console/TagChips";

type TagOption = { id: string; name: string; color: "blue" | "green" | "amber" | "red" | "violet" | "gray" };

/**
 * The bar of a selection: tag, untag, decide — at most 200 at a time, one transaction, one audit line per file. A decision that
 * asks for it needs a second press, and says what it does: the file closes and its documents are erased.
 * TODO(krizaka-ui#627): delete this wrapper the day the DataTable selection bar ships; the props stay.
 */
export function SelectionBar({ kind, ids, set, tags, onDone }: { kind: string; ids: readonly string[]; set: StatusSet; tags: readonly TagOption[]; onDone: () => void }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [armed, setArmed] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const call = useMutation({ mutationFn: (request: { path: string; json: object }) => krizakaFetch(`/api/organize/${kind}/${request.path}`, { method: "POST", json: request.json }) });
  const moves = movesFrom(set, set.initial ?? "", OWNER_ROLE);
  const run = async (path: string, json: object, done: (answer: Record<string, unknown>) => string) => {
    setMessage(null);
    try {
      const answer = (await call.mutateAsync({ path, json })) as Record<string, unknown>;
      setMessage({ tone: "success", text: done(answer) });
      onDone();
      router.refresh();
    } catch (error) {
      setMessage({ tone: "danger", text: say(`errors.${errorKey(error)}`) });
    }
  };
  const decide = (to: string, confirm: boolean) => {
    const next = press(armed, to, confirm);
    setArmed(next.armed);
    if (next.send) void run("status", { ids, to }, (a) => say("dossiers.bulk.done", { moved: (a.moved as unknown[]).length, skipped: (a.skipped as unknown[]).length }));
  };
  const retag = (tagId: string, mode: "add" | "remove") => run("tags/apply", { ids, [mode]: [tagId] }, (a) => say("dossiers.bulk.tagged", { count: Number(a.changed) }));
  const tagMenu = (label: string, mode: "add" | "remove") => (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="md">
          {label}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        {tags.length === 0 ? (
          <DropdownMenu.Item disabled>{say("dossiers.bulk.noTags")}</DropdownMenu.Item>
        ) : (
          tags.map((t) => (
            <DropdownMenu.Item key={t.id} onSelect={() => void retag(t.id, mode)}>
              <TagChips tags={[t]} />
            </DropdownMenu.Item>
          ))
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
  if (ids.length === 0) return message ? <Alert tone={message.tone}>{message.text}</Alert> : null;
  return (
    <div role="region" aria-label={say("dossiers.bulk.label")} className="sticky top-2 z-10 flex flex-col gap-2 rounded-lg border border-border-default bg-surface-2 p-3" data-testid="selection-bar">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-fg">{say(pluralKey("dossiers.bulk.selected", ids.length), { count: ids.length })}</span>
        {tagMenu(say("dossiers.bulk.tag"), "add")}
        {tagMenu(say("dossiers.bulk.untag"), "remove")}
        {moves.map((m) => {
          const state = set.states.find((s) => s.key === m.to)?.label[locale] ?? m.to;
          const isArmed = armed === m.to;
          return (
            <Button key={m.to} variant={m.confirm ? "secondary" : "primary"} size="md" loading={call.isPending} onClick={() => decide(m.to, m.confirm === true)}>
              {say(isArmed ? "dossiers.decide.confirm" : "dossiers.decide.mark", { state })}
            </Button>
          );
        })}
        <Button variant="ghost" size="md" onClick={() => { setArmed(null); onDone(); }}>
          {say("dossiers.bulk.clear")}
        </Button>
      </div>
      {armed ? <p className="m-0 text-sm text-fg-secondary">{say("dossiers.decide.final")}</p> : null}
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
    </div>
  );
}
