"use client";

import { BarChart } from "@krizaka/charts/bar";
import { Sparkline } from "@krizaka/charts/sparkline";
import { CheckIcon, KnowledgeIcon, SearchIcon, UsersIcon } from "@krizaka/icons";
import { CardGrid } from "@krizaka/ui/card-grid";
import { LinkCard } from "@krizaka/ui/link-card";
import { Meter } from "@krizaka/ui/meter";
import { Stat, StatGrid } from "@krizaka/ui/stat";
import { Tabs } from "@krizaka/ui/tabs";
import Link from "next/link";

import { type BinderTab, type CreditsFigure, homeHref, leadParts, type QuickId, quickLinks, type StripFigure } from "@/lib/home-b2";
import { type ActivityDay, HOME_PERIODS, type HomePeriod, type ToDo } from "@/lib/home-figures";
import { useSay } from "@/lib/i18n-client";
import { pluralKey } from "@/lib/plural";
import { atOffsets } from "@/lib/text-parts";

import { formatDate, INTL } from "./format";

/*
 * The pieces of the B2 home (yomizaka#332, design § 5.6) that are not the binder: the sentence under the heading, and the
 * side column — quick access, the activity strip, the week, the credits. All of them are Krizaka UI / Krizaka Charts blocks.
 * Waiting on krizaka-ui#651: the strip becomes `StatGrid variant="strip"` (one row, sparkline and trend in words) when it ships.
 * Waiting on krizaka-ui#709: the quick access leads the side column via `DashboardLayout quickActionsPlacement="side"`.
 * Waiting on krizaka-ui#710: the charts' French words (and the sparkline table's « Category » header) come from `@krizaka/charts` itself.
 * Waiting on krizaka-ui#641: the credits meter, the period switch and the usage chart become `@krizaka/ui/usage` when it ships.
 */

const QUICK_ICONS: Record<QuickId, typeof CheckIcon> = { request: UsersIcon, documents: KnowledgeIcon, checks: CheckIcon, search: SearchIcon };

/** The sentence under the heading: « Vous avez 6 vérifications à regarder, … », each figure a link to the view it counts. */
export function HomeLead({ todo }: Readonly<{ todo: ToDo }>) {
  const { say, locale } = useSay();
  return (
    <>
      {atOffsets(leadParts(todo, locale, say)).map((part) =>
        part.href ? (
          <Link key={part.at} href={part.href} className="font-semibold text-fg-accent hover:underline" data-testid="lead-figure">
            {part.text}
          </Link>
        ) : (
          <span key={part.at}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** The chart's own words in the person's language (it speaks English otherwise); the menu of downloads is left out, the table stays. */
function chartWords(say: ReturnType<typeof useSay>["say"]) {
  return {
    showData: say("home.week.chart.showData"),
    hideData: say("home.week.chart.hideData"),
    tableCaption: say("home.week.chart.tableCaption"),
    keyboardHint: say("home.week.chart.keyboardHint"),
    roleDescription: say("home.week.chart.roleDescription"),
    empty: say("home.week.chart.empty"),
    kinds: { bar: say("home.week.chart.kind") },
  };
}

/** The 7 · 30 · 90 d switch: the period lives in the address and keeps the binder's open tab. */
function PeriodSwitch({ period, collection }: Readonly<{ period: HomePeriod; collection: string | null }>) {
  const { say, locale } = useSay();
  const href = (p: HomePeriod) => homeHref(locale, { period: p, collection });
  return (
    <Tabs.Nav label={say("home.activity.periodsLabel")} current={href(period)} variant="segmented">
      {HOME_PERIODS.map((p) => (
        <Tabs.NavLink key={p} href={href(p)} exact asChild>
          <Link href={href(p)} scroll={false}>
            {say(`home.activity.periods.${p}`)}
          </Link>
        </Tabs.NavLink>
      ))}
    </Tabs.Nav>
  );
}

/** The activity of the period as one discreet strip: compact figures, each with its sparkline. */
export function ActivityStrip({ figures, period, collection }: Readonly<{ figures: readonly StripFigure[]; period: HomePeriod; collection: string | null }>) {
  const { say, locale } = useSay();
  const words = chartWords(say);
  return (
    <section className="flex flex-col gap-3" aria-label={say("home.activity.title")} data-testid="activity">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 font-display text-base font-bold text-fg">{say("home.activity.title")}</h2>
        <PeriodSwitch period={period} collection={collection} />
      </div>
      <StatGrid divided minWidth={8}>
        {figures.map((f) => {
          const figureName = say(`home.activity.${f.id}`);
          const periodName = say(`home.activity.periods.${period}`);
          return (
          <Stat
            key={f.id}
            label={figureName}
            value={new Intl.NumberFormat(INTL[locale]).format(f.total)}
            hint={periodName}
            data-testid={`strip-${f.id}`}
            chart={<Sparkline data={f.values} variant="area" width={96} height={24} title={figureName} summaryText={`${figureName}, ${periodName}: ${f.total}`} locale={INTL[locale]} labels={words} />}
          />
          );
        })}
      </StatGrid>
    </section>
  );
}

/** The checks of the last seven days, as bars; its table is in the page (the chart's own data table, for screen readers and « Voir les données »). */
export function WeekChart({ days }: Readonly<{ days: readonly ActivityDay[] }>) {
  const { say, locale } = useSay();
  return (
    <section className="flex flex-col gap-2" aria-label={say("home.week.title")} data-testid="week">
      <h2 className="m-0 font-display text-base font-bold text-fg">{say("home.week.title")}</h2>
      <BarChart
        data={days}
        x="day"
        y="checks"
        yLabel={say("home.week.checks")}
        xLabel={say("home.week.day")}
        hideTitle
        title={say("home.week.summary")}
        height={140}
        locale={INTL[locale]}
        labels={chartWords(say)}
        exportable={false}
        actionsMenu={false}
        summaryText={`${say("home.week.summary")}: ${days.reduce((n, d) => n + d.checks, 0)}`}
      />
    </section>
  );
}

/** Where the person goes most, two by two. */
export function QuickAccess({ applicantFiles }: Readonly<{ applicantFiles: boolean }>) {
  const { say, locale } = useSay();
  return (
    <nav aria-label={say("home.quick.label")} data-testid="quick-access">
      <CardGrid as="ul" min={132} reveal={false}>
        {quickLinks(locale, applicantFiles).map((q) => {
          const Icon = QUICK_ICONS[q.id];
          return (
            <LinkCard key={q.id} href={q.href} linkAs={Link} icon={<Icon size={20} />} title={say(`home.quick.${q.id}.title`)} description={say(`home.quick.${q.id}.hint`)} titleAs="span" layout="stack" />
          );
        })}
      </CardGrid>
    </nav>
  );
}

/** The credits: what the account has, from the billing state — the meter for Pro against its fair-use cap, the audits left otherwise. */
export function Credits({ figure }: Readonly<{ figure: CreditsFigure }>) {
  const { say, locale } = useSay();
  return (
    <section className="flex flex-col gap-2" aria-label={say("home.credits.title")} data-testid="credits">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 font-display text-base font-bold text-fg">{say("home.credits.title")}</h2>
        <Link href={`/${locale}/app/settings/facturation`} className="text-sm font-semibold text-fg-accent hover:underline">
          {say("home.credits.manage")} →
        </Link>
      </div>
      {figure.kind === "included" ? <p className="m-0 text-sm text-fg-secondary">{say("home.credits.included")}</p> : null}
      {figure.kind === "credits" ? <p className="m-0 text-sm text-fg">{say(pluralKey("home.credits.left", figure.left), { count: figure.left })}</p> : null}
      {figure.kind === "pro" ? (
        <>
          <Meter label={say("home.credits.title")} value={figure.used} min={0} max={figure.cap} valueText={say("home.credits.pro", { used: figure.used, cap: figure.cap })} thresholds={{ low: 0.8, high: 0.95 }} optimum="low" />
          <p className="m-0 text-sm text-fg-secondary">{say("home.credits.pro", { used: figure.used, cap: figure.cap })}</p>
          {figure.renewsAt ? <p className="m-0 text-xs text-fg-muted">{say("home.credits.renews", { date: formatDate(figure.renewsAt, locale) })}</p> : null}
        </>
      ) : null}
    </section>
  );
}

/** Binder tabs: a tab per collection with its count, the open one in the address. */
export function BinderTabs({ tabs, selectedHref }: Readonly<{ tabs: readonly BinderTab[]; selectedHref: string }>) {
  const { say } = useSay();
  return (
    <Tabs.Nav label={say("home.binder.label")} current={selectedHref} variant="binder">
      {tabs.map((t) => (
        <Tabs.NavLink key={t.id} href={t.href} hue={t.hue} exact asChild>
          <Link href={t.href} scroll={false}>
            {t.name} <span className="tabular-nums" data-testid="binder-count">{t.count}</span>
          </Link>
        </Tabs.NavLink>
      ))}
    </Tabs.Nav>
  );
}

