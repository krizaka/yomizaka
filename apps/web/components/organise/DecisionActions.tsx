"use client";

import { movesFrom, type StatusSet } from "@krizaka/organize/contract";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { StatusChip } from "@krizaka/ui/status-chip";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import { OWNER_ROLE } from "@/lib/workspace/decl";
import { press } from "@/lib/workspace/press";

/**
 * The decision of one file: its state as a chip, then the moves the set allows from it — each a button; the one that asks for it needs
 * a second press. The state the manager saw travels with the call (`expect`): if someone decided meanwhile, they are told (STALE).
 * After a decision there is nothing to press and no undo: the documents are gone.
 */
export function DecisionActions({ fileId, state, set }: Readonly<{ fileId: string; state: string; set: StatusSet }>) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [armed, setArmed] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const move = useMutation({
    mutationFn: (to: string) =>
      krizakaFetch("/api/organize/applicant_file/status", {
        method: "POST",
        json: { ids: [fileId], to, expect: state },
      }),
  });
  const moves = movesFrom(set, state, OWNER_ROLE);
  const go = async (to: string, confirm: boolean) => {
    const next = press(armed, to, confirm);
    setArmed(next.armed);
    if (!next.send) return;
    setProblem(null);
    try {
      await move.mutateAsync(to);
      router.refresh();
    } catch (error) {
      setProblem(say(`errors.${errorKey(error)}`));
    }
  };
  return (
    <section aria-labelledby="decision-title" className="flex flex-col gap-3" data-testid="file-decision">
      <h2 id="decision-title" className="m-0 text-lg font-bold text-fg">
        {say("dossiers.decide.title")}
      </h2>
      <p className="m-0 flex items-center gap-2 text-sm text-fg-secondary">
        <StatusChip set={set} state={state} role={OWNER_ROLE} locale={locale} />
      </p>
      {moves.length ? (
        <>
          <div className="flex flex-wrap gap-3">
            {moves.map((m) => {
              const label = set.states.find((s) => s.key === m.to)?.label[locale] ?? m.to;
              return (
                <Button
                  key={m.to}
                  variant={m.confirm ? "secondary" : "primary"}
                  size="md"
                  loading={move.isPending}
                  onClick={() => void go(m.to, m.confirm === true)}
                >
                  {say(armed === m.to ? "dossiers.decide.confirm" : "dossiers.decide.mark", { state: label })}
                </Button>
              );
            })}
          </div>
          <p className="m-0 text-sm text-fg-secondary">{say("dossiers.decide.final")}</p>
        </>
      ) : null}
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
    </section>
  );
}
