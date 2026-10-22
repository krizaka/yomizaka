"use client";

import { krizakaFetch, useMutation, useQuery } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Avatar } from "@krizaka/ui/avatar";
import { Button } from "@krizaka/ui/button";
import { Dialog } from "@krizaka/ui/dialog";
import { createKrizakaForm } from "@krizaka/ui/form";
import { RadioGroup } from "@krizaka/ui/radio-group";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { z } from "zod";

import { RouteTabs } from "@/components/RouteTabs";
import { useAppConfig } from "@/lib/app-config-client";
import { errorKey } from "@/lib/client";
import { SETTINGS_SECTIONS } from "@/lib/console-nav";
import { formI18n } from "@/lib/form-i18n";
import { useSay } from "@/lib/i18n-client";

/** The sections of the settings: the tab is the route (/app/settings/<section>). */
export function SettingsTabs({ children }: { children: ReactNode }) {
  const { say, locale } = useSay();
  const app = useAppConfig();
  const items = SETTINGS_SECTIONS.filter((s) => s !== "stockage" || app?.features.ownStorage !== false).map((s) => ({ value: s, label: say(`settings.tabs.${s}`) }));
  return (
    <RouteTabs base={`/${locale}/app/settings`} label={say("settings.label")} items={items}>
      {children}
    </RouteTabs>
  );
}

function useCall<T>(run: (input: T) => Promise<unknown>) {
  const { say } = useSay();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const m = useMutation({ mutationFn: run });
  return {
    problem,
    done,
    pending: m.isPending,
    go: async (input: T, then?: () => void) => {
      setProblem(null);
      setDone(false);
      try {
        await m.mutateAsync(input);
        setDone(true);
        if (then) then();
        else router.refresh();
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  };
}


// ── profile ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const nameForm = createKrizakaForm({ schema: z.object({ name: z.string().trim().max(80) }), defaultValues: { name: "" } });
export const AVATAR_SEEDS = ["v1", "v2", "v3", "v4", "v5", "v6"] as const;

/** Name, avatar and language: each saved on its own, the language also moves to the other language's URL. */
export function ProfileSection({ email, name, avatarSeed, locale: current, children }: { email: string; name: string | null; avatarSeed: string | null; locale: "en" | "fr"; children?: ReactNode }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const patch = useCall<Record<string, unknown>>((body) => krizakaFetch("/api/me/profile", { method: "PATCH", json: body }));
  const form = nameForm.useForm({ ...formI18n(say, locale), defaultValues: { name: name ?? "" }, onSubmit: (v) => patch.go({ name: v.name === "" ? null : v.name }) });
  const [seed, setSeed] = useState<string>(avatarSeed ?? "");
  return (
    <div className="flex max-w-2xl flex-col gap-8" data-testid="settings-profil">
      <section className="flex flex-col gap-3" aria-label={say("settings.profile.nameLabel")}>
        <form.Form aria-label={say("settings.profile.nameLabel")} className="flex flex-col gap-3">
          <form.TextField name="name" label={say("settings.profile.nameLabel")} hint={say("settings.profile.nameHint")} maxLength={80} autoComplete="name" />
          <div className="flex items-center gap-3">
            <form.Submit size="md">{say("settings.profile.save")}</form.Submit>
            {patch.done ? <span role="status" className="text-sm text-fg-secondary">{say("settings.profile.saved")}</span> : null}
          </div>
        </form.Form>
        {patch.problem ? <Alert tone="danger">{patch.problem}</Alert> : null}
      </section>

      <section className="flex flex-col gap-3" aria-label={say("settings.profile.avatarLabel")}>
        <RadioGroup.Root label={say("settings.profile.avatarLabel")} value={seed} onValueChange={(v: string) => { setSeed(v); void patch.go({ avatarSeed: v }); }}>
          <div className="flex flex-wrap gap-3">
            {AVATAR_SEEDS.map((s) => (
              <RadioGroup.Item key={s} value={s} aria-label={`${say("settings.profile.avatarLabel")} ${s}`}>
                <Avatar size="lg" defaultAvatar={{ brand: "yomizaka", seed: s }} alt="" fallback={email.charAt(0).toUpperCase()} />
              </RadioGroup.Item>
            ))}
          </div>
        </RadioGroup.Root>
        <p className="m-0 text-sm text-fg-secondary">{say("settings.profile.avatarHint")}</p>
      </section>

      <section className="flex flex-col gap-3" aria-label={say("settings.profile.languageLabel")}>
        {/* @ephemeral: a saved account setting (PATCH /me), not a view selection */}
        <RadioGroup.Root variant="segmented" label={say("settings.profile.languageLabel")} value={current} onValueChange={async (v: string) => { await patch.go({ locale: v }, () => router.replace(`/${v}/app/settings/profil`)); }}>
          {(["fr", "en"] as const).map((l) => (
            <RadioGroup.Segment key={l} value={l}>
              {say(`settings.profile.languages.${l}`)}
            </RadioGroup.Segment>
          ))}
        </RadioGroup.Root>
      </section>
      {children}
    </div>
  );
}

// ── security ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const emailForm = createKrizakaForm({ schema: z.object({ newEmail: z.string().trim().min(1).email(), password: z.string().min(1) }), defaultValues: { newEmail: "", password: "" } });
const passwordForm = createKrizakaForm({ schema: z.object({ current: z.string().min(1), next: z.string().min(12).max(256) }), defaultValues: { current: "", next: "" } });

export function SecuritySection({ email, pendingEmail, notice }: { email: string; pendingEmail: string | null; notice: "changed" | "invalid" | null }) {
  const { say, locale } = useSay();
  const mail = useCall<{ newEmail: string; password: string }>((body) => krizakaFetch("/api/me/email", { method: "POST", json: body }));
  const pass = useCall<{ current: string; next: string }>((body) => krizakaFetch("/api/me/password", { method: "PUT", json: body }));
  const emailF = emailForm.useForm({ ...formI18n(say, locale), onSubmit: (v) => mail.go(v) });
  const passF = passwordForm.useForm({ ...formI18n(say, locale), onSubmit: (v) => pass.go(v) });
  return (
    <div className="flex max-w-2xl flex-col gap-8" data-testid="settings-securite">
      {notice ? <Alert tone={notice === "changed" ? "success" : "danger"}>{say(notice === "changed" ? "settings.security.emailChanged" : "settings.security.emailInvalid")}</Alert> : null}
      <section className="flex flex-col gap-3" aria-label={say("settings.security.emailTitle")}>
        <h2 className="m-0 font-display text-lg font-bold text-fg">{say("settings.security.emailTitle")}</h2>
        <p className="m-0 text-sm text-fg-secondary">{say("settings.security.emailCurrent", { email })}</p>
        {pendingEmail ? <Alert tone="info">{say("settings.security.emailPending", { email: pendingEmail })}</Alert> : null}
        <emailF.Form aria-label={say("settings.security.emailTitle")} className="flex flex-col gap-3">
          <emailF.TextField name="newEmail" label={say("settings.security.newEmail")} type="email" autoComplete="email" />
          <emailF.TextField name="password" label={say("settings.security.password")} type="password" autoComplete="current-password" />
          {mail.problem ? <Alert tone="danger">{mail.problem}</Alert> : null}
          {mail.done ? <Alert tone="success">{say("settings.security.emailSent")}</Alert> : null}
          <div>
            <emailF.Submit size="md">{say("settings.security.emailSend")}</emailF.Submit>
          </div>
        </emailF.Form>
      </section>
      <section className="flex flex-col gap-3" aria-label={say("settings.security.passwordTitle")}>
        <h2 className="m-0 font-display text-lg font-bold text-fg">{say("settings.security.passwordTitle")}</h2>
        <passF.Form aria-label={say("settings.security.passwordTitle")} className="flex flex-col gap-3">
          <passF.TextField name="current" label={say("settings.security.current")} type="password" autoComplete="current-password" />
          <passF.TextField name="next" label={say("settings.security.next")} type="password" autoComplete="new-password" />
          {pass.problem ? <Alert tone="danger">{pass.problem}</Alert> : null}
          {pass.done ? <Alert tone="success">{say("settings.security.passwordChanged")}</Alert> : null}
          <div>
            <passF.Submit size="md">{say("settings.security.passwordSave")}</passF.Submit>
          </div>
        </passF.Form>
      </section>
    </div>
  );
}

// ── billing ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const billing = z.object({
  entitlement: z.object({ credits: z.number(), pro: z.boolean(), proUntil: z.string().nullable(), freeAuditUsed: z.boolean(), selfServe: z.boolean(), hasCustomer: z.boolean() }),
  paymentsOn: z.boolean(),
  paymentsDisplay: z.string().optional(),
});
const redirect = z.object({ url: z.string().url() });

/** The plan and its billing: what the account has, and the Stripe portal (subscription, payment method, invoices). */
export function BillingSection() {
  const { say, locale } = useSay();
  const info = useQuery({ queryKey: ["billing-settings"], queryFn: () => krizakaFetch("/api/billing", { schema: billing }) });
  const portal = useCall<null>(async () => window.location.assign((await krizakaFetch("/api/billing/portal", { method: "POST", schema: redirect })).url));
  const buy = useCall<"audit" | "pro">(async (kind) => window.location.assign((await krizakaFetch("/api/billing/checkout", { method: "POST", json: { kind }, schema: redirect })).url));
  const e = info.data?.entitlement;
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
  return (
    <div className="flex max-w-2xl flex-col gap-4" data-testid="settings-facturation">
      <h2 className="m-0 font-display text-lg font-bold text-fg">{say("settings.billing.title")}</h2>
      {e ? (
        <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-fg-secondary">{say("settings.billing.plan")}</dt>
          <dd className="m-0 font-semibold" data-testid="plan-name">{say(e.pro ? "settings.billing.planPro" : "settings.billing.planFree")}</dd>
        </dl>
      ) : null}
      {e ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-fg-secondary">
          {e.selfServe ? <li>{say(e.freeAuditUsed ? "settings.billing.freeUsed" : "settings.billing.freeAvailable")}</li> : null}
          <li>{say("settings.billing.credits", { count: e.credits })}</li>
          {e.pro && e.proUntil ? <li>{say("settings.billing.until", { date: date(e.proUntil) })}</li> : null}
        </ul>
      ) : null}
      {info.data && !info.data.paymentsOn ? <Alert tone="info">{say("settings.billing.off")}</Alert> : null}
      {info.data?.paymentsOn && info.data.paymentsDisplay === "test" ? <Alert tone="warning">{say("settings.billing.testMode")}</Alert> : null}
      {info.data?.paymentsOn ? (
        <div className="flex flex-wrap gap-3">
          {e?.hasCustomer ? (
            <Button size="md" variant="secondary" loading={portal.pending} onClick={() => portal.go(null, () => undefined)}>
              {say("settings.billing.portal")}
            </Button>
          ) : null}
          {e && !e.pro ? (
            <>
              <Button size="md" variant="secondary" loading={buy.pending} onClick={() => buy.go("audit", () => undefined)}>
                {say("paywall.payOne")}
              </Button>
              <Button size="md" loading={buy.pending} onClick={() => buy.go("pro", () => undefined)}>
                {say("paywall.pro")}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      {portal.problem || buy.problem ? <Alert tone="danger">{portal.problem ?? buy.problem}</Alert> : null}
      <p className="m-0 text-sm text-fg-secondary">{say("settings.billing.portalHint")}</p>
    </div>
  );
}

// ── my data ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const deleteForm = createKrizakaForm({ schema: z.object({ email: z.string().trim().min(1), password: z.string().min(1) }), defaultValues: { email: "", password: "" } });

/** Loi 25: access (export) and erasure. The erasure asks for the e-mail address and the password. */
export function DataSection() {
  const { say, locale } = useSay();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const erase = useCall<{ email: string; password: string }>((body) => krizakaFetch("/api/me/delete", { method: "POST", json: body }));
  const form = deleteForm.useForm({ ...formI18n(say, locale), onSubmit: (v) => erase.go(v, () => router.replace(`/${locale}`)) });
  return (
    <div className="flex max-w-2xl flex-col gap-8" data-testid="settings-donnees">
      <section className="flex flex-col gap-3" aria-label={say("settings.data.exportTitle")}>
        <h2 className="m-0 font-display text-lg font-bold text-fg">{say("settings.data.exportTitle")}</h2>
        <p className="m-0 text-sm text-fg-secondary">{say("settings.data.exportText")}</p>
        <div>
          <Button asChild size="md" variant="secondary">
            <a href="/api/me/export" download data-testid="export-link">
              {say("settings.data.exportButton")}
            </a>
          </Button>
        </div>
      </section>
      <section className="flex flex-col gap-3" aria-label={say("settings.data.deleteTitle")}>
        <h2 className="m-0 font-display text-lg font-bold text-fg">{say("settings.data.deleteTitle")}</h2>
        <p className="m-0 text-sm text-fg-secondary">{say("settings.data.deleteText")}</p>
        <div>
          <Button size="md" variant="danger" onClick={() => setOpen(true)}>
            {say("settings.data.deleteOpen")}
          </Button>
        </div>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Content closeLabel={say("organisation.cancel")}>
            <Dialog.Header>
              <Dialog.Title>{say("settings.data.deleteTitle")}</Dialog.Title>
              <Dialog.Description>{say("settings.data.deleteText")}</Dialog.Description>
            </Dialog.Header>
            <Dialog.Body>
              <form.Form aria-label={say("settings.data.deleteTitle")} className="flex flex-col gap-3">
                <form.TextField name="email" label={say("settings.data.deleteEmail")} type="email" autoComplete="off" />
                <form.TextField name="password" label={say("settings.data.deletePassword")} type="password" autoComplete="current-password" />
                {erase.problem ? <Alert tone="danger">{erase.problem}</Alert> : null}
                <form.Submit size="md" variant="danger">
                  {say("settings.data.deleteButton")}
                </form.Submit>
              </form.Form>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Root>
      </section>
    </div>
  );
}
