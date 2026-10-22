"use client";

import { krizakaFetch, useMutation, useQuery } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Checkbox } from "@krizaka/ui/checkbox";
import { createKrizakaForm } from "@krizaka/ui/form";
import { RadioGroup } from "@krizaka/ui/radio-group";
import { SettingsSection } from "@krizaka/ui/settings-layout";
import { STORAGE_MODE, STORAGE_MODES, type StorageMode } from "@yomizaka/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { formI18n } from "@/lib/form-i18n";
import { useSay } from "@/lib/i18n-client";


const step = z.object({ name: z.enum(["write", "read", "delete"]), ok: z.boolean(), ms: z.number(), error: z.string().optional() });
const verification = z.object({ verification: z.object({ ok: z.boolean(), steps: z.array(step), host: z.string().nullable(), region: z.string(), residency: z.enum(["canada", "elsewhere"]), error: z.string().nullable() }) });
const current = z.object({
  settings: z.object({ mode: z.enum(STORAGE_MODES), keepDefault: z.boolean(), s3: z.object({ endpoint: z.string(), region: z.string(), bucket: z.string(), accessKeyId: z.string(), hasSecret: z.boolean() }).nullable(), testedAt: z.string().nullable() }),
  canStoreCredentials: z.boolean(),
});

const s3Form = createKrizakaForm({
  schema: z.object({ endpoint: z.string().trim().min(1), region: z.string().trim().min(1), bucket: z.string().trim().min(1), accessKeyId: z.string().trim().min(1), secretAccessKey: z.string().max(400) }),
  defaultValues: { endpoint: "", region: "", bucket: "", accessKeyId: "", secretAccessKey: "" },
});

type Verification = z.infer<typeof verification>["verification"];

/** Where the documents a person keeps live: nothing, Krizaka's store, or their own S3 — verified (write, read, delete) before it is saved. */
export function StorageSection() {
  const { say, locale } = useSay();
  const router = useRouter();
  const info = useQuery({ queryKey: ["storage-settings"], queryFn: () => krizakaFetch("/api/me/storage", { schema: current }), staleTime: 0 });
  if (!info.data) return null;
  return <StorageForm key={info.data.settings.testedAt ?? "new"} initial={info.data.settings} canStoreCredentials={info.data.canStoreCredentials} say={say} locale={locale} onSaved={() => { void info.refetch(); router.refresh(); }} />;
}

function StorageForm({ initial, canStoreCredentials, say, locale, onSaved }: { initial: z.infer<typeof current>["settings"]; canStoreCredentials: boolean; say: (k: string, v?: Record<string, string | number>) => string; locale: string; onSaved: () => void }) {
  const [mode, setMode] = useState<StorageMode>(initial.mode);
  const [keepDefault, setKeepDefault] = useState(initial.keepDefault);
  const [verified, setVerified] = useState<Verification | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const values = () => form.getValues() as { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };
  const body = () => ({ ...values(), secretAccessKey: values().secretAccessKey || undefined });
  const test = useMutation({ mutationFn: () => krizakaFetch("/api/me/storage/test", { method: "POST", json: body(), schema: verification }) });
  const save = useMutation({ mutationFn: () => krizakaFetch("/api/me/storage", { method: "PUT", json: { mode, keepDefault: mode === STORAGE_MODE.none ? false : keepDefault, ...(mode === STORAGE_MODE.s3 ? { s3: body() } : {}) } }) });
  const form = s3Form.useForm({
    ...formI18n(say, locale),
    defaultValues: { endpoint: initial.s3?.endpoint ?? "", region: initial.s3?.region ?? "", bucket: initial.s3?.bucket ?? "", accessKeyId: initial.s3?.accessKeyId ?? "", secretAccessKey: "" },
    onSubmit: async () => {
      setProblem(null);
      setSaved(false);
      try {
        await save.mutateAsync();
        setSaved(true);
        onSaved();
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  });
  const runTest = async () => {
    setProblem(null);
    setVerified(null);
    try {
      const out = await test.mutateAsync();
      setVerified(out.verification);
      if (out.verification.error) setProblem(say(`errors.${out.verification.error}`));
    } catch (error) {
      setProblem(say(`errors.${errorKey(error)}`));
    }
  };
  const needsTest = mode === STORAGE_MODE.s3 && !verified?.ok;
  const step = (n: "write" | "read" | "delete") => ({ write: "stepWrite", read: "stepRead", delete: "stepDelete" })[n];
  return (
    <div data-testid="settings-stockage">
      <SettingsSection variant="flat" title={say("settings.storage.title")} description={say("settings.storage.lead")}>
      <RadioGroup.Root label={say("settings.storage.modeLabel")} value={mode} onValueChange={(v: string) => { setMode(v as StorageMode); setSaved(false); setVerified(null); }}>
        {STORAGE_MODES.map((m) => (
          <RadioGroup.Item key={m} value={m} disabled={m === STORAGE_MODE.s3 && !canStoreCredentials}>
            <span className="flex flex-col">
              <span className="font-semibold">{say(`settings.storage.${m}`)}</span>
              <span className="text-sm font-normal text-fg-secondary">{say(`settings.storage.${m}Hint`)}</span>
            </span>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {!canStoreCredentials ? <Alert tone="info">{say("settings.storage.noKey")}</Alert> : null}
      <form.Form aria-label={say("settings.storage.title")} className="flex flex-col gap-4">
        {mode === STORAGE_MODE.s3 ? (
          <>
            <form.TextField name="endpoint" label={say("settings.storage.endpoint")} type="url" autoComplete="off" placeholder="https://s3.example.com" />
            <div className="grid gap-4 sm:grid-cols-2">
              <form.TextField name="region" label={say("settings.storage.region")} autoComplete="off" placeholder="ca-central-1" />
              <form.TextField name="bucket" label={say("settings.storage.bucket")} autoComplete="off" />
            </div>
            <form.TextField name="accessKeyId" label={say("settings.storage.accessKeyId")} autoComplete="off" />
            <form.TextField name="secretAccessKey" label={say("settings.storage.secretAccessKey")} type="password" autoComplete="off" hint={initial.s3?.hasSecret ? say("settings.storage.secretSaved") : say("settings.storage.secretHint")} />
            <p className="m-0 text-sm text-fg-secondary">{say("settings.storage.steps")}</p>
            <div>
              <Button type="button" variant="secondary" size="md" loading={test.isPending} onClick={runTest}>
                {say("settings.storage.test")}
              </Button>
            </div>
            {verified && verified.steps.length > 0 ? (
              <div className="flex flex-col gap-2" data-testid="connection-result">
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                  {verified.steps.map((s) => (
                    <li key={s.name} className={s.ok ? "text-fg" : "text-danger"}>
                      {s.ok ? "✓" : "✕"} {say(`settings.storage.${step(s.name)}`)} · {s.ok ? say("settings.storage.stepOk") : `${say("settings.storage.stepFail")}${s.error ? ` (${s.error})` : ""}`}
                    </li>
                  ))}
                </ul>
                {verified.ok && verified.host ? <Alert tone={verified.residency === "canada" ? "success" : "warning"}>{say(verified.residency === "canada" ? "settings.storage.whereCanada" : "settings.storage.whereElsewhere", { host: verified.host, region: verified.region })}</Alert> : null}
              </div>
            ) : null}
          </>
        ) : null}
        {mode === STORAGE_MODE.none ? null : (
          <div className="flex items-center gap-3">
            <Checkbox id="keep-default" checked={keepDefault} onCheckedChange={(v) => { setKeepDefault(v === true); setSaved(false); }} />
            <label htmlFor="keep-default" className="cursor-pointer text-sm">{say("settings.storage.keepDefault")}</label>
          </div>
        )}
        {problem ? <Alert tone="danger">{problem}</Alert> : null}
        {needsTest ? <p className="m-0 text-sm text-fg-secondary">{say("settings.storage.testRequired")}</p> : null}
        <div className="flex items-center gap-3">
          <form.Submit size="md" disabled={needsTest}>{say("settings.storage.save")}</form.Submit>
          {saved ? <span role="status" className="text-sm text-fg-secondary">{say("settings.storage.saved")}</span> : null}
        </div>
      </form.Form>
      </SettingsSection>
    </div>
  );
}
