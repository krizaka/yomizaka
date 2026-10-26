"use client";

import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Meter } from "@krizaka/ui/meter";

import { useSay } from "@/lib/i18n-client";
import type { DatabaseBudget, PoolUsage, Queue, RecentError, RulesetUse } from "@/lib/operations";
import { usageShare } from "@/lib/operations-shared";

import { formatDate } from "../console/format";

type Translate = (key: string, vars?: Record<string, string | number>) => string;
type Lang = ReturnType<typeof useSay>["locale"];

function errorColumnsOf(t: Translate, locale: Lang): DataTableColumn<RecentError>[] {
  return [
    { id: "at", header: t("when"), sortable: true, value: (e) => e.at, cell: (e) => formatDate(e.at, locale, true) },
    { id: "kind", header: t("kind"), cell: (e) => <Badge tone={e.kind === "run" ? "danger" : "warning"}>{t(`kinds.${e.kind}`)}</Badge> },
    { id: "detail", header: t("detail"), card: "title" },
  ];
}

function rulesetColumnsOf(t: Translate, locale: Lang): DataTableColumn<RulesetUse>[] {
  return [
    { id: "rulesetId", header: t("ruleset"), card: "title" },
    { id: "rulesetVersion", header: t("version") },
    { id: "jurisdiction", header: t("jurisdiction") },
    { id: "checks", header: t("checks"), align: "end", sortable: true },
    { id: "lastAt", header: t("lastCheck"), cell: (r) => formatDate(r.lastAt, locale, true) },
  ];
}

/** The operations page: what is used against what is allowed, what is waiting, what failed, which rules and which key. */
export function OperationsView({ pool, budget, queue, errors, rulesets, signing }: Readonly<{ pool: PoolUsage; budget: DatabaseBudget; queue: Queue; errors: RecentError[]; rulesets: RulesetUse[]; signing: { keyId: string; development: boolean } }>) {
  const { say, locale } = useSay();
  const t = (key: string, vars?: Record<string, string | number>) => say(`adminConsole.operations.${key}`, vars);
  const errorColumns = errorColumnsOf(t, locale);
  const rulesetColumns = rulesetColumnsOf(t, locale);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card.Root className="flex flex-col gap-3 p-4">
          <h2 className="font-display text-base font-bold text-fg">{t("database")}</h2>
          <Meter showLabel thresholds={{ low: 0.7, high: 0.9 }} label={t("pool", { busy: pool.total - pool.idle, open: pool.total, max: pool.max })} value={usageShare(pool.total - pool.idle, pool.max)} max={1} />
          <Meter showLabel thresholds={{ low: 0.7, high: 0.9 }} label={t("connections", { used: budget.open, max: budget.limit })} value={usageShare(budget.open, budget.limit)} max={1} />
          <p className="text-xs text-fg-muted">{t("poolNote", { waiting: pool.waiting })}</p>
        </Card.Root>
        <Card.Root className="flex flex-col gap-3 p-4">
          <h2 className="font-display text-base font-bold text-fg">{t("queue")}</h2>
          <DescriptionList
            items={[
              ...["running", "succeeded", "failed", "cancelled"].map((s) => ({ term: t(`status.${s}`), details: String(queue.byStatus[s] ?? 0) })),
              { term: t("stuck", { minutes: queue.stuckMinutes }), details: <Badge tone={queue.stuck > 0 ? "danger" : "success"}>{queue.stuck}</Badge> },
            ]}
          />
        </Card.Root>
        <Card.Root className="flex flex-col gap-3 p-4">
          <h2 className="font-display text-base font-bold text-fg">{t("signing")}</h2>
          <DescriptionList
            items={[
              { term: t("keyId"), details: <code className="font-mono text-xs" data-testid="signing-key-id">{signing.keyId}</code> },
              { term: t("keyState"), details: <Badge tone={signing.development ? "warning" : "success"}>{t(signing.development ? "keyDevelopment" : "keyProduction")}</Badge> },
            ]}
          />
        </Card.Root>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-base font-bold text-fg">{t("errors")}</h2>
        <DataTable caption={t("errors")} rows={errors} columns={errorColumns} getRowId={(e) => `${e.kind}-${e.at}-${e.target ?? ""}`} empty={<p className="p-4 text-sm text-fg-muted">{t("noErrors")}</p>} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-base font-bold text-fg">{t("rulesets")}</h2>
        <DataTable caption={t("rulesets")} rows={rulesets} columns={rulesetColumns} getRowId={(r) => `${r.rulesetId}-${r.rulesetVersion}`} empty={<p className="p-4 text-sm text-fg-muted">{t("noRulesets")}</p>} />
      </section>
    </div>
  );
}
