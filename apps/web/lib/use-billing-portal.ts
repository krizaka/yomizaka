"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

const redirect = z.object({ url: z.string().url() });

/** Sends the customer to the processor's secure portal (receipts, card); `problem` holds the words of a refusal, `open` is the click. */
export function useBillingPortal() {
  const { say } = useSay();
  const [problem, setProblem] = useState<string | null>(null);
  const portal = useMutation({
    mutationFn: () => krizakaFetch("/api/billing/portal", { method: "POST", schema: redirect }),
  });
  const open = async () => {
    setProblem(null);
    try {
      globalThis.location.assign((await portal.mutateAsync()).url);
    } catch (error) {
      setProblem(say(`errors.${errorKey(error)}`));
    }
  };
  return { open, pending: portal.isPending, problem };
}
