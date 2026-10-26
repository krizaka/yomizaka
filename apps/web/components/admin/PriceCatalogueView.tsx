"use client";

import { krizakaFetch, useQuery, useQueryClient } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { DatePicker } from "@krizaka/ui/date-picker";
import { Input } from "@krizaka/ui/field";
import { RadioGroup } from "@krizaka/ui/radio-group";
import { SettingsRow, SettingsSection, useSaveStatus } from "@krizaka/ui/settings-layout";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import { draftOf, effectiveFromOf, patchOf,type PriceDraft, type PriceFields } from "@/lib/prices/edit";
import { money } from "@/lib/prices/format";

const fields = { unit: z.string(), amountCents: z.number().nullable(), availability: z.string(), limits: z.record(z.string(), z.number()) };
const entry = z.object({ key: z.string(), versionId: z.string(), effectiveFrom: z.string(), ...fields, upcoming: z.array(z.object({ versionId: z.string(), effectiveFrom: z.string(), ...fields })) });
const line = z.object({ versionId: z.string(), at: z.string(), actorLabel: z.string(), effectiveFrom: z.string(), before: z.object(fields).passthrough().nullable(), after: z.object(fields).passthrough() });
const answer = z.object({
  availabilities: z.array(z.string()),
  entries: z.array(entry),
  history: z.record(z.string(), z.array(line)),
  processor: z.object({ mode: z.enum(["test", "live"]).nullable(), amounts: z.record(z.string(), z.number().nullable()) }),
});
type Entry = z.infer<typeof entry>;
type Line = z.infer<typeof line> & { key: string };
type Say = (key: string, vars?: Record<string, string | number>) => string;

const SEED = "seed:";

/**
 * The price catalogue (ADR-009, yomizaka#367): each entry with its amount, availability and limits, a change scheduled from a
 * date (never in the past), what the processor charges beside it, and every change with who made it. Composed from
 * `SettingsSection` / `SettingsRow` until Krizaka UI's price-list block exists (krizaka/krizaka-ui#713).
 */
export function PriceCatalogueView() {
  const { say } = useSay();
  const data = useQuery({ queryKey: ["admin-prices"], queryFn: () => krizakaFetch("/api/admin/prices", { schema: answer }) });
  if (!data.data) return null;
  const { entries, availabilities, processor, history } = data.data;
  return (
    <div className="flex flex-col gap-6" data-testid="prices-catalogue">
      <div className="flex flex-col gap-1">
        <p className="m-0 max-w-[70ch] text-sm text-fg-secondary">{say("adminConfig.prices.lead")}</p>
        {processor.mode === null ? <Alert tone="info">{say("adminConfig.prices.processorOff")}</Alert> : <p className="m-0 text-sm">{say("adminConfig.prices.processorMode")}: <Badge tone={processor.mode === "live" ? "danger" : "neutral"}>{processor.mode}</Badge></p>}
      </div>
      {entries.map((e) => (
        <PriceSection key={`${e.key}:${e.versionId}:${e.upcoming.length}`} entry={e} availabilities={availabilities} charged={processor.amounts[e.key]} />
      ))}
      <History lines={entries.flatMap((e) => (history[e.key] ?? []).filter((l) => !l.versionId.startsWith(SEED)).map((l) => ({ ...l, key: e.key })))} />
    </div>
  );
}

function PriceSection({ entry: e, availabilities, charged }: { entry: Entry; availabilities: string[]; charged: number | null | undefined }) {
  const { say, locale } = useSay();
  const client = useQueryClient();
  const save = useSaveStatus();
  const saved: PriceFields = { amountCents: e.amountCents, availability: e.availability, limits: e.limits };
  const [draft, setDraft] = useState<PriceDraft>(() => draftOf(saved));
  const [problem, setProblem] = useState<string | null>(null);
  const patch = patchOf(saved, draft);
  const dirty = patch === null || Object.keys(patch).length > 0 || draft.from !== null;
  const today = format(new Date(), "yyyy-MM-dd");
  const id = e.key.replace(".", "-");
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
  const shown = (cents: number | null) => (cents === null ? say("adminConfig.prices.onQuote") : money(cents, locale));
  const onSave = () =>
    void save.track(async () => {
      setProblem(null);
      if (patch === null) {
        setProblem(say("errors.BAD_VALUE"));
        throw new Error("BAD_VALUE");
      }
      try {
        await krizakaFetch("/api/admin/prices", { method: "POST", json: { key: e.key, ...patch, effectiveFrom: effectiveFromOf(draft.from, today) } });
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
        throw error;
      }
      await client.invalidateQueries({ queryKey: ["admin-prices"] });
    });
  return (
    <SettingsSection
      variant="flat"
      title={say(`adminConfig.prices.entries.${e.key.split(".")[1]}`)}
      description={`${e.key} · ${say(`adminConfig.prices.units.${e.unit}`)} · ${e.versionId.startsWith(SEED) ? say("adminConfig.prices.seed") : say("adminConfig.prices.since", { date: date(e.effectiveFrom) })}`}
      data-testid={`price-${e.key}`}
      save={{
        dirty,
        status: save.status,
        onSave,
        onDiscard: dirty
          ? () => {
              setDraft(draftOf(saved));
              save.reset();
            }
          : undefined,
        labels: { save: say("adminConfig.prices.schedule"), saving: say("settings.save.saving"), saved: say("settings.save.saved"), error: problem ?? say("settings.save.error"), undo: say("settings.save.undo"), discard: say("settings.save.discard") },
      }}
    >
      <SettingsRow label={say("adminConfig.prices.amount")} description={say("adminConfig.prices.amountHint")} htmlFor={`${id}-amount`}>
        <Input id={`${id}-amount`} inputMode="decimal" value={draft.amount} onChange={(ev) => setDraft({ ...draft, amount: ev.target.value })} />
      </SettingsRow>
      <SettingsRow label={say("adminConfig.prices.availability")} description={say("adminConfig.prices.availabilityHint")}>
        {/* @ephemeral: the value of a price being edited (saved by the section's save), not a view selection */}
        <RadioGroup.Root variant="segmented" label={`${say("adminConfig.prices.availability")} — ${e.key}`} value={draft.availability} onValueChange={(v: string) => setDraft({ ...draft, availability: v })}>
          {availabilities.map((a) => (
            <RadioGroup.Segment key={a} value={a}>
              {say(`adminConfig.prices.availabilities.${a}`)}
            </RadioGroup.Segment>
          ))}
        </RadioGroup.Root>
      </SettingsRow>
      {Object.keys(draft.limits).map((k) => (
        <SettingsRow key={k} label={say(`adminConfig.prices.limits.${k}`)} htmlFor={`${id}-${k}`}>
          <Input id={`${id}-${k}`} inputMode="numeric" value={draft.limits[k]} onChange={(ev) => setDraft({ ...draft, limits: { ...draft.limits, [k]: ev.target.value } })} />
        </SettingsRow>
      ))}
      <SettingsRow label={say("adminConfig.prices.from")} description={say("adminConfig.prices.fromHint")}>
        <DatePicker label={`${say("adminConfig.prices.from")} — ${e.key}`} locale={locale} min={today} clearable value={draft.from} onValueChange={(v) => setDraft({ ...draft, from: v })} />
      </SettingsRow>
      {charged !== undefined ? (
        <SettingsRow label={say("adminConfig.prices.charged")} description={say("adminConfig.prices.chargedHint")}>
          <span className="flex flex-wrap items-center gap-2 text-sm">
            {charged === null ? say("adminConfig.prices.notFound") : money(charged, locale)}
            {charged !== e.amountCents ? <Badge tone="danger">{say("adminConfig.prices.mismatch")}</Badge> : <Badge tone="success">{say("adminConfig.prices.match")}</Badge>}
          </span>
        </SettingsRow>
      ) : null}
      {e.upcoming.length ? (
        <SettingsRow label={say("adminConfig.prices.upcoming")}>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {e.upcoming.map((u) => (
              <li key={u.versionId}>{say("adminConfig.prices.upcomingLine", { date: date(u.effectiveFrom), amount: shown(u.amountCents), availability: say(`adminConfig.prices.availabilities.${u.availability}`) })}</li>
            ))}
          </ul>
        </SettingsRow>
      ) : null}
    </SettingsSection>
  );
}

const describe = (p: PriceFields, say: Say, locale: "en" | "fr") =>
  [p.amountCents === null ? say("adminConfig.prices.onQuote") : money(p.amountCents, locale), say(`adminConfig.prices.availabilities.${p.availability}`), ...Object.entries(p.limits).map(([k, v]) => `${say(`adminConfig.prices.limits.${k}`)} ${v}`)].join(" · ");

/** Every change of the catalogue: when, who, which entry, from when, before and after. */
function History({ lines }: { lines: Line[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<Line>[]>(
    () => [
      { id: "when", header: say("adminConfig.history.when"), value: (l) => l.at, cell: (l) => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(l.at)) },
      { id: "who", header: say("adminConfig.history.who"), value: (l) => l.actorLabel },
      { id: "what", header: say("adminConfig.history.what"), value: (l) => l.key, cell: (l) => <code className="text-xs">{l.key}</code> },
      { id: "from", header: say("adminConfig.prices.from"), value: (l) => l.effectiveFrom, cell: (l) => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(l.effectiveFrom)) },
      { id: "before", header: say("adminConfig.history.before"), value: (l) => (l.before ? describe(l.before, say, locale) : "—") },
      { id: "after", header: say("adminConfig.history.after"), value: (l) => describe(l.after, say, locale) },
    ],
    [say, locale],
  );
  const rows = [...lines].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section aria-label={say("adminConfig.prices.historyTitle")} className="flex flex-col gap-2" data-testid="prices-history">
      <h2 className="m-0 font-display text-lg font-bold text-fg">{say("adminConfig.prices.historyTitle")}</h2>
      {rows.length === 0 ? <p className="m-0 text-sm text-fg-secondary">{say("adminConfig.history.empty")}</p> : <DataTable caption={say("adminConfig.prices.historyTitle")} rows={rows} columns={columns} getRowId={(l) => l.versionId} rowLabel={(l) => l.key} />}
    </section>
  );
}
