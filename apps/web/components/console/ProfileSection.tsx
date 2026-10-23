"use client";

import { krizakaFetch } from "@krizaka/query";
import { AvatarPicker, ChoiceCards, LanguagePicker } from "@krizaka/ui/account-settings";
import { Input } from "@krizaka/ui/field";
import { SettingsRow, SettingsSection, useSaveStatus } from "@krizaka/ui/settings-layout";
import { type Audience, AVATAR_SEEDS } from "@yomizaka/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

/** What the profile section edits: the name, the picture, the language, which side of the lease. */
export interface ProfileValues {
  name: string;
  avatarSeed: string;
  locale: "en" | "fr";
  perspective: Audience | null;
}

/** Whether anything differs from what is saved: the one save is enabled only then. */
export const profileDirty = (saved: ProfileValues, current: ProfileValues): boolean =>
  saved.name.trim() !== current.name.trim() || saved.avatarSeed !== current.avatarSeed || saved.locale !== current.locale || saved.perspective !== current.perspective;

/** What the account API receives for the change: the profile patch (name, picture, language) and the perspective, each only when it changed. */
export function profilePatch(saved: ProfileValues, current: ProfileValues): { profile: { name: string | null; avatarSeed: string | null; locale: "en" | "fr" } | null; perspective: Audience | null } {
  const name = current.name.trim();
  const profile = saved.name.trim() !== name || saved.avatarSeed !== current.avatarSeed || saved.locale !== current.locale ? { name: name === "" ? null : name, avatarSeed: current.avatarSeed === "" ? null : current.avatarSeed, locale: current.locale } : null;
  const perspective = current.perspective && saved.perspective !== current.perspective ? current.perspective : null;
  return { profile, perspective };
}

const SOON = { available: false, soon: true } as const;
const LANGUAGES = ["fr", "en"] as const;

/**
 * The profile as one section with one save (the review's E2): name, picture (`AvatarPicker`), language (`LanguagePicker`),
 * which side of the lease (`ChoiceCards`) — dirty → saving → saved, with an undo; a changed language moves the page to it.
 */
export function ProfileSection({ initial, audiences }: { initial: ProfileValues; audiences: readonly { audience: Audience; status: "available" | "soon" }[] }) {
  const { say } = useSay();
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [previous, setPrevious] = useState<ProfileValues | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useSaveStatus();
  const apply = async (next: ProfileValues, from: ProfileValues) => {
    const { profile, perspective } = profilePatch(from, next);
    if (profile) await krizakaFetch("/api/me/profile", { method: "PATCH", json: profile });
    if (perspective) await krizakaFetch("/api/me/perspective", { method: "PUT", json: { perspective } });
  };
  const run = async (next: ProfileValues, from: ProfileValues) => {
    setProblem(null);
    const ok = await save.track(async () => {
      try {
        await apply(next, from);
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
        throw error;
      }
    });
    if (!ok) return;
    setPrevious(from);
    setSaved(next);
    setValues(next);
    if (next.locale !== from.locale) router.replace(`/${next.locale}/app/settings/profil`);
    else router.refresh();
  };
  const dirty = profileDirty(saved, values);
  return (
    <SettingsSection
      variant="flat"
      title={say("settings.tabs.profil")}
      description={say("settings.profile.lead")}
      data-testid="settings-profil"
      save={{
        dirty,
        status: save.status,
        onSave: () => void run(values, saved),
        onUndo: previous ? () => void run(previous, saved) : undefined,
        onDiscard: dirty
          ? () => {
              setValues(saved);
              save.reset();
            }
          : undefined,
        labels: { save: say("settings.save.save"), saving: say("settings.save.saving"), saved: say("settings.save.saved"), error: problem ?? say("settings.save.error"), undo: say("settings.save.undo"), discard: say("settings.save.discard") },
      }}
    >
      <SettingsRow label={say("settings.profile.nameLabel")} description={say("settings.profile.nameHint")} htmlFor="profile-name">
        <Input id="profile-name" value={values.name} maxLength={80} autoComplete="name" onChange={(e) => setValues({ ...values, name: e.target.value })} />
      </SettingsRow>
      <SettingsRow label={say("settings.profile.avatarLabel")} description={say("settings.profile.avatarHint")}>
        <AvatarPicker dense label={say("settings.profile.avatarLabel")} options={AVATAR_SEEDS.map((seed, i) => ({ id: seed, label: say("settings.profile.avatarOption", { n: i + 1 }), defaultAvatar: { brand: "yomizaka" as const, seed } }))} value={values.avatarSeed} onValueChange={(id) => setValues({ ...values, avatarSeed: id })} />
      </SettingsRow>
      <SettingsRow label={say("settings.profile.languageLabel")} description={say("settings.profile.languageHint")}>
        <LanguagePicker label={say("settings.profile.languageLabel")} showLabel={false} languages={LANGUAGES.map((code) => ({ code, name: say(`settings.profile.languages.${code}`) }))} value={values.locale} onValueChange={(code) => setValues({ ...values, locale: code as "en" | "fr" })} />
      </SettingsRow>
      <SettingsRow label={say("profile.legend")} description={say("profile.lead")}>
        <ChoiceCards
          label={say("profile.legend")}
          options={audiences.map(({ audience, status }) => ({ id: audience, title: `${say(`profile.${audience}`)}${SOON[status] ? ` (${say("profile.soon")})` : ""}`, description: say(`profile.${audience}Hint`) }))}
          value={values.perspective ?? undefined}
          onValueChange={(id) => setValues({ ...values, perspective: id as Audience })}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
