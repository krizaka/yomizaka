"use client";

import { movesFrom, type StatusSet } from "@krizaka/organize/contract";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { Button } from "@krizaka/ui/button";
import { DropdownMenu } from "@krizaka/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import { OWNER_ROLE } from "@/lib/workspace/decl";
import { press } from "@/lib/workspace/press";

import { TagChips } from "../console/TagChips";

type TagOption = { id: string; name: string; color: "blue" | "green" | "amber" | "red" | "violet" | "gray" };

/**
 * What the product gives the selection bar of the table (`DataTable bulkActions`; the bar, its count, « Clear selection » and the 200 ceiling
 * are Krizaka UI's): tag, untag, decide — one transaction, one audit line per file. A decision that asks for it needs a second press,
 * and says what it does: the file closes and its documents are erased. What the call did goes back to the bar (`onResult`).
 */
export function BulkActions({ kind, ids, set, tags, onResult, onDone }: { kind: string; ids: readonly string[]; set: StatusSet; tags: readonly TagOption[]; onResult: (text: string) => void; onDone: () => void }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [armed, setArmed] = useState<string | null>(null);
  const call = useMutation({ mutationFn: (request: { path: string; json: object }) => krizakaFetch(`/api/organize/${kind}/${request.path}`, { method: "POST", json: request.json }) });
  const moves = movesFrom(set, set.initial ?? "", OWNER_ROLE);
  const run = async (path: string, json: object, done: (answer: Record<string, unknown>) => string) => {
    onResult("");
    try {
      const answer = (await call.mutateAsync({ path, json })) as Record<string, unknown>;
      onResult(done(answer));
      onDone();
      router.refresh();
    } catch (error) {
      onResult(say(`errors.${errorKey(error)}`));
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
  return (
    <>
      {tagMenu(say("dossiers.bulk.tag"), "add")}
      {tagMenu(say("dossiers.bulk.untag"), "remove")}
      {moves.map((m) => {
        const state = set.states.find((s) => s.key === m.to)?.label[locale] ?? m.to;
        return (
          <Button key={m.to} variant={m.confirm ? "secondary" : "primary"} size="md" loading={call.isPending} onClick={() => decide(m.to, m.confirm === true)}>
            {say(armed === m.to ? "dossiers.decide.confirm" : "dossiers.decide.mark", { state })}
          </Button>
        );
      })}
      {armed ? <span className="text-sm text-fg-secondary">{say("dossiers.decide.final")}</span> : null}
    </>
  );
}
