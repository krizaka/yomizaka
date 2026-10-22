"use client";

import { krizakaFetch, useMutation, useQuery } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

const summary = z.object({ paymentsOn: z.boolean(), fairUsePerMonth: z.number() });
const redirect = z.object({ url: z.string().url() });

/** The second audit: pay for this one or subscribe. Without payment configured it says so — no button that leads nowhere. */
export function Paywall({ reason }: { reason: "PAYWALL" | "FAIR_USE" }) {
  const { say } = useSay();
  const [problem, setProblem] = useState<string | null>(null);
  const info = useQuery({ queryKey: ["billing"], queryFn: () => krizakaFetch("/api/billing", { schema: summary }) });
  const go = useMutation({
    mutationFn: (kind: "audit" | "pro") => krizakaFetch("/api/billing/checkout", { method: "POST", json: { kind }, schema: redirect }),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => setProblem(say(`errors.${errorKey(error)}`)),
  });
  if (reason === "FAIR_USE") return <Alert tone="warning" title={say("paywall.fairUseTitle")}>{say("paywall.fairUse", { limit: info.data?.fairUsePerMonth ?? 0 })}</Alert>;
  return (
    <Alert tone="info" title={say("paywall.title")}>
      <p>{say("paywall.text")}</p>
      {info.data?.paymentsOn ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <Button size="md" disabled={go.isPending} onClick={() => go.mutate("audit")}>
            {say("paywall.payOne")}
          </Button>
          <Button size="md" variant="secondary" disabled={go.isPending} onClick={() => go.mutate("pro")}>
            {say("paywall.pro")}
          </Button>
        </div>
      ) : info.data ? (
        <p className="mt-3 font-semibold" data-testid="payments-soon">
          {say("paywall.soon")}
        </p>
      ) : null}
      {problem ? <p className="mt-2">{problem}</p> : null}
      <p className="mt-3 text-sm">{say("paywall.notice")}</p>
    </Alert>
  );
}
