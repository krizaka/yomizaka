"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { RadioGroup } from "@krizaka/ui/radio-group";
import { type Audience } from "@yomizaka/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

/**
 * Which side of the lease the person is on: asked once at onboarding (the library shows it until a side is chosen) and
 * changeable in settings. It changes the checks offered first and the wording, never the rules.
 */
export function PerspectiveChooser({ current, audiences, onboarding = false }: { current: Audience | null; audiences: readonly { audience: Audience; status: "available" | "soon" }[]; onboarding?: boolean }) {
  const { say } = useSay();
  const router = useRouter();
  const [value, setValue] = useState<Audience | null>(current);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (perspective: Audience) => krizakaFetch("/api/me/perspective", { method: "PUT", json: { perspective } }),
    onSuccess: () => {
      setSaved(true);
      router.refresh();
    },
  });
  return (
    <Card.Root className="flex flex-col gap-3 p-4" data-testid={onboarding ? "perspective-onboarding" : "perspective-settings"}>
      <h2 className="font-display text-lg font-bold text-fg">{say("profile.title")}</h2>
      <p className="text-sm text-fg-secondary">{say("profile.lead")}</p>
      <RadioGroup.Root label={say("profile.legend")} value={value ?? ""} onValueChange={(v: string) => { setSaved(false); setValue(v as Audience); }}>
        {audiences.map(({ audience: p, status }) => (
          <RadioGroup.Item key={p} value={p}>
            {say(`profile.${p}`)}
            {status === "soon" ? ` · ${say("profile.soon")}` : ""}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <div className="flex items-center gap-3">
        <Button
          size="md"
          disabled={!value || value === current}
          loading={save.isPending}
          onClick={async () => {
            setProblem(null);
            try {
              await save.mutateAsync(value!);
            } catch (error) {
              setProblem(say(`errors.${errorKey(error)}`));
            }
          }}
        >
          {say("profile.save")}
        </Button>
        {saved ? <span role="status" className="text-sm text-fg-secondary">{say("profile.saved")}</span> : null}
      </div>
    </Card.Root>
  );
}
