"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import type { SoldKind } from "@/lib/pricing";

const redirect = z.object({ url: z.string().url() });

/**
 * « Subscribe — Agency » / « Pay for one document » on the in-app plans page (krizaka-internal#1901): the same checkout as
 * Plan and billing (`/api/billing/checkout`), then the processor's hosted page. The plan the account is on shows « Current plan ».
 */
export function SubscribeButton({ kind, plan, current }: Readonly<{ kind: SoldKind; plan: string; current: boolean }>) {
  const { say } = useSay();
  const [problem, setProblem] = useState<string | null>(null);
  const buy = useMutation({
    mutationFn: () => krizakaFetch("/api/billing/checkout", { method: "POST", json: { kind }, schema: redirect }),
    onSuccess: ({ url }) => globalThis.location.assign(url),
    onError: (error) => setProblem(say(`errors.${errorKey(error)}`)),
  });
  if (current) {
    return (
      <Button size="md" variant="secondary" disabled data-testid={`plan-${kind}`}>
        {say("pricing.current")}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="md"
        variant={kind === "agency" ? "primary" : "secondary"}
        shape="cut"
        loading={buy.isPending}
        onClick={() => buy.mutate()}
        data-testid={`plan-${kind}`}
      >
        {say("pricing.subscribe", { plan })}
      </Button>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
    </div>
  );
}
