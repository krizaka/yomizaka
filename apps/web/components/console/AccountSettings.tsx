"use client";

import { krizakaFetch, useMutation, useQuery } from "@krizaka/query";
import { AccountProfileCard, AvatarPicker, ChoiceCards, LanguagePicker } from "@krizaka/ui/account-settings";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Dialog } from "@krizaka/ui/dialog";
import { Field, Input } from "@krizaka/ui/field";
import { createKrizakaForm } from "@krizaka/ui/form";
import { SettingsLayout, SettingsRow, SettingsSection, useSaveStatus } from "@krizaka/ui/settings-layout";
import { type Audience, AVATAR_SEEDS } from "@yomizaka/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import * as React from "react";
import { type ReactNode, useState } from "react";
import { z } from "zod";

import { useAppConfig } from "@/lib/app-config-client";
import { errorKey } from "@/lib/client";
import { SETTINGS_SECTIONS } from "@/lib/console-nav";
import { formI18n } from "@/lib/form-i18n";
import { useSay } from "@/lib/i18n-client";

/** The settings page: its sections on the side (chips on a phone), each one a route (/app/settings/<section>), the active one read from the path. */
export function SettingsShell({ children }: { children: ReactNode }) {
  const { say, locale } = useSay();
  const app = useAppConfig();
  const path = usePathname() ?? "";
  const base = `/${locale}/app/settings`;
  const nav = SETTINGS_SECTIONS.filter((s) => s !== "stockage" || app?.features.ownStorage !== false).map((s) => ({ id: s, label: say(`settings.tabs.${s}`), href: `${base}/${s}`, current: path === `${base}/${s}` }));
  return (
    <SettingsLayout variant="flat" title={say("profile.settingsTitle")} nav={nav} navLabel={say("settings.profile.navLabel")} linkAs={Link}>
      {children}
    </SettingsLayout>
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

export const LANGUAGES = ["fr", "en"] as const;

/** What the profile section edits: saved together, with one button. */
export interface ProfileDraft {
  name: string;
  avatarSeed: string;
  locale: "en" | "fr";
}

/** The request one profile save needs: only the fields that changed (null when nothing did). */
export function profilePatch(from: ProfileDraft, to: ProfileDraft) {
  const patch: Record<string, unknown> = {};
  if (to.name !== from.name) patch.name = to.name.trim() === "" ? null : to.name.trim();
  if (to.avatarSeed !== from.avatarSeed) patch.avatarSeed = to.avatarSeed || null;
  if (to.locale !== from.locale) patch.locale = to.locale;
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * One section's draft against what is saved. The section is clean at once when it saves (optimistic); a failure puts the last
 * saved values back and says so; Undo saves the previous ones again.
 */
function useSectionDraft<T>(initial: T, persist: (from: T, to: T) => Promise<void>) {
  const { say } = useSay();
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const previous = React.useRef(initial);
  const status = useSaveStatus();
  const commit = async (to: T) => {
    const from = saved;
    setSaved(to);
    setDraft(to);
    if (!(await status.track(() => persist(from, to)))) setSaved(from);
  };
  return {
    draft,
    set: (patch: Partial<T>) => setDraft({ ...draft, ...patch }),
    save: {
      dirty: JSON.stringify(draft) !== JSON.stringify(saved),
      status: status.status,
      labels: { save: say("settings.profile.save"), saving: say("settings.profile.saving"), saved: say("settings.profile.saved"), error: say("settings.profile.saveError"), undo: say("settings.profile.undo"), discard: say("settings.profile.discard") },
      onDiscard: () => setDraft(saved),
      onSave: () => {
        previous.current = saved;
        void commit(draft);
      },
      onUndo: () => void commit(previous.current),
    },
  };
}

/** Profile (name, picture, language) and the side of the lease: the Orazaka way — calm rows, one section per subject, one save each. */
export function ProfileSection({ email, emailVerified, name, avatarSeed, locale: current, perspective, audiences }: { email: string; emailVerified: boolean; name: string | null; avatarSeed: string | null; locale: "en" | "fr"; perspective: Audience | null; audiences: readonly { audience: Audience; status: "available" | "soon" }[] }) {
  const { say } = useSay();
  const router = useRouter();
  const profile = useSectionDraft<ProfileDraft>({ name: name ?? "", avatarSeed: avatarSeed ?? "", locale: current }, async (from, to) => {
    const patch = profilePatch(from, to);
    if (patch) await krizakaFetch("/api/me/profile", { method: "PATCH", json: patch });
    if (to.locale !== from.locale) router.replace(`/${to.locale}/app/settings/profil`);
    else router.refresh();
  });
  const side = useSectionDraft<{ perspective: Audience | "" }>({ perspective: perspective ?? "" }, async (_from, to) => {
    if (to.perspective) await krizakaFetch("/api/me/perspective", { method: "PUT", json: { perspective: to.perspective } });
    router.refresh();
  });
  return (
    <div data-testid="settings-profil" className="flex flex-col gap-10">
      <SettingsSection variant="flat" title={say("settings.profile.sectionTitle")} description={say("settings.profile.sectionLead")} save={profile.save}>
        <SettingsRow
          label={
            <AccountProfileCard
              compact
              name={profile.draft.name || email}
              email={email}
              verified={emailVerified}
              verifiedLabel={say("settings.profile.verified")}
              unverifiedLabel={say("settings.profile.unverified")}
              avatar={{ defaultAvatar: { brand: "yomizaka", seed: profile.draft.avatarSeed || email } }}
            />
          }
        />
        <SettingsRow label={say("settings.profile.nameLabel")} description={say("settings.profile.nameHint")} htmlFor="profile-name">
          <Field.Root>
            <Input id="profile-name" className="w-full sm:w-72" value={profile.draft.name} maxLength={80} autoComplete="name" onChange={(event) => profile.set({ name: event.target.value })} />
          </Field.Root>
        </SettingsRow>
        <SettingsRow label={say("settings.profile.avatarLabel")} description={say("settings.profile.avatarHint")}>
          <AvatarPicker
            dense
            label={say("settings.profile.avatarLabel")}
            value={profile.draft.avatarSeed}
            onValueChange={(avatarSeed) => profile.set({ avatarSeed })}
            options={AVATAR_SEEDS.map((seed, i) => ({ id: seed, label: say("settings.profile.avatarOption", { n: i + 1 }), defaultAvatar: { brand: "yomizaka", seed } }))}
          />
        </SettingsRow>
        <SettingsRow label={say("settings.profile.languageLabel")} description={say("settings.profile.languageHint")}>
          <LanguagePicker
            showLabel={false}
            label={say("settings.profile.languageLabel")}
            value={profile.draft.locale}
            onValueChange={(locale) => profile.set({ locale: locale as "en" | "fr" })}
            languages={LANGUAGES.map((code) => ({ code, name: say(`settings.profile.languages.${code}`) }))}
          />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection variant="flat" title={say("profile.title")} description={say("profile.settingsLead")} save={side.save}>
        <div className="py-4">
          <ChoiceCards
            label={say("profile.title")}
            value={side.draft.perspective}
            onValueChange={(next) => side.set({ perspective: next as Audience })}
            options={audiences.map(({ audience, status: soon }) => ({ id: audience, title: `${say(`profile.${audience}`)}${soon === "soon" ? ` (${say("profile.soon")})` : ""}`, description: say(`profile.${audience}Hint`) }))}
          />
        </div>
      </SettingsSection>
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
    <div className="flex flex-col gap-6" data-testid="settings-securite">
      {notice ? <Alert tone={notice === "changed" ? "success" : "danger"}>{say(notice === "changed" ? "settings.security.emailChanged" : "settings.security.emailInvalid")}</Alert> : null}
      <SettingsSection variant="flat" title={say("settings.security.emailTitle")} description={say("settings.security.emailCurrent", { email })}>
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
      </SettingsSection>
      <SettingsSection variant="flat" title={say("settings.security.passwordTitle")}>
        <passF.Form aria-label={say("settings.security.passwordTitle")} className="flex flex-col gap-3">
          <passF.TextField name="current" label={say("settings.security.current")} type="password" autoComplete="current-password" />
          <passF.TextField name="next" label={say("settings.security.next")} type="password" autoComplete="new-password" />
          {pass.problem ? <Alert tone="danger">{pass.problem}</Alert> : null}
          {pass.done ? <Alert tone="success">{say("settings.security.passwordChanged")}</Alert> : null}
          <div>
            <passF.Submit size="md">{say("settings.security.passwordSave")}</passF.Submit>
          </div>
        </passF.Form>
      </SettingsSection>
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
  const actions = info.data?.paymentsOn ? (
    <>
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
    </>
  ) : undefined;
  return (
    <div data-testid="settings-facturation">
      <SettingsSection variant="flat" title={say("settings.billing.title")} description={say("settings.billing.portalHint")} footer={actions}>
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
      {portal.problem || buy.problem ? <Alert tone="danger">{portal.problem ?? buy.problem}</Alert> : null}
     </SettingsSection>
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
    <div className="flex flex-col gap-6" data-testid="settings-donnees">
      <SettingsSection variant="flat"
        title={say("settings.data.exportTitle")}
        description={say("settings.data.exportText")}
        footer={
          <Button asChild size="md" variant="secondary">
            <a href="/api/me/export" download data-testid="export-link">
              {say("settings.data.exportButton")}
            </a>
          </Button>
        }
      />
      <SettingsSection variant="flat"
        title={say("settings.data.deleteTitle")}
        description={say("settings.data.deleteText")}
        footer={
          <Button size="md" variant="danger" onClick={() => setOpen(true)}>
            {say("settings.data.deleteOpen")}
          </Button>
        }
      >
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
      </SettingsSection>
    </div>
  );
}
