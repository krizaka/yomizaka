"use client";

import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Progress } from "@krizaka/ui/progress";

import { useSay } from "@/lib/i18n-client";
import type { MoveView } from "@/lib/storage/provider-move";

/** The slice of a provider the panel needs: its id, its name and its status. */
export interface MoveProvider {
  id: string;
  label: string;
  status: string;
}

const PROGRESS_STATUS = { running: "active", paused: "paused", attention: "error", done: "active" } as const;
const TONE = { running: "accent", paused: "warning", attention: "danger", done: "success" } as const;

/**
 * The move of the documents to a new provider (ADR-005 §3): offered once the default has changed (the old provider is `retiring`), then its
 * progress: moved, failed, remaining, pause and resume; when done, the old provider can be retired. Counts only, never a key or a credential.
 */
export function StorageMove({
  providers,
  defaultId,
  move,
  busy,
  onCall,
}: Readonly<{
  providers: MoveProvider[];
  defaultId: string | undefined;
  move: MoveView | null;
  busy: boolean;
  onCall: (path: string, json?: unknown) => void;
}>) {
  const { say } = useSay();
  const name = (id: string) => providers.find((p) => p.id === id)?.label ?? id;
  const retiring = providers.find((p) => p.status === "retiring");
  const shown = move && (move.status !== "done" || retiring?.id === move.fromId) ? move : null;
  if (!shown && !(retiring && defaultId)) return null;
  return (
    <section
      aria-label={say("adminConsole.storage.move.title")}
      className="flex flex-col gap-4 rounded-lg border border-border p-4"
      data-testid="storage-move"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="m-0 font-display text-lg font-bold text-fg">{say("adminConsole.storage.move.title")}</h2>
        {shown ? (
          <Badge tone={TONE[shown.status]}>{say(`adminConsole.storage.move.statuses.${shown.status}`)}</Badge>
        ) : null}
      </header>
      <p className="m-0 max-w-[70ch] text-sm text-fg-secondary">{say("adminConsole.storage.move.lead")}</p>
      {shown ? <Moving move={shown} from={name(shown.fromId)} busy={busy} onCall={onCall} /> : null}
      {!shown && retiring && defaultId ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 text-sm text-fg">
            {say("adminConsole.storage.move.offer", { from: retiring.label, to: name(defaultId) })}
          </p>
          <Button
            variant="primary"
            size="md"
            disabled={busy}
            onClick={() => onCall("/api/admin/storage/move", { from: retiring.id, to: defaultId })}
          >
            {say("adminConsole.storage.move.start")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function Moving({
  move,
  from,
  busy,
  onCall,
}: Readonly<{ move: MoveView; from: string; busy: boolean; onCall: (path: string, json?: unknown) => void }>) {
  const { say } = useSay();
  const stopped = move.status === "paused";
  return (
    <div className="flex flex-col gap-4">
      <Progress
        value={move.moved}
        max={Math.max(move.total, 1)}
        label={say("adminConsole.storage.move.label")}
        valueText={say("adminConsole.storage.move.progress", { moved: move.moved, total: move.total })}
        showLabel
        status={PROGRESS_STATUS[move.status]}
      />
      <dl className="m-0 grid grid-cols-3 gap-3 text-sm" data-testid="storage-move-counts">
        <Count label={say("adminConsole.storage.move.moved")} value={move.moved} />
        <Count label={say("adminConsole.storage.move.failed")} value={move.failed.length} />
        <Count label={say("adminConsole.storage.move.remaining")} value={move.remaining} />
      </dl>
      <div className="flex flex-wrap gap-2">
        {move.status === "running" ? (
          <Button variant="secondary" size="md" disabled={busy} onClick={() => onCall("/api/admin/storage/move/pause")}>
            {say("adminConsole.storage.move.pause")}
          </Button>
        ) : null}
        {stopped || move.status === "attention" ? (
          <Button variant="primary" size="md" disabled={busy} onClick={() => onCall("/api/admin/storage/move/resume")}>
            {say(move.failed.length > 0 ? "adminConsole.storage.move.resumeRetry" : "adminConsole.storage.move.resume")}
          </Button>
        ) : null}
        {move.status === "done" ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="md"
              disabled={busy}
              onClick={() => onCall(`/api/admin/storage/${move.fromId}/retire`)}
            >
              {say("adminConsole.storage.move.retire", { provider: from })}
            </Button>
            <p className="m-0 text-sm text-fg-secondary">{say("adminConsole.storage.move.retireHint")}</p>
          </div>
        ) : null}
      </div>
      {move.failed.length > 0 ? (
        <Alert tone="danger">
          <p className="m-0 font-bold">{say("adminConsole.storage.move.failures")}</p>
          <ul className="m-0 mt-1 list-disc pl-5 text-sm">
            {move.failed.map((f) => (
              <li key={f.id} className="break-all">
                <code>{f.id}</code> · {f.reason}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}

function Count({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="flex flex-col">
      <dt className="text-fg-secondary">{label}</dt>
      <dd className="m-0 font-display text-xl font-bold text-fg">{value}</dd>
    </div>
  );
}
