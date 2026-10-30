"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";

import { useSay } from "@/lib/i18n-client";
import { useBillingPortal } from "@/lib/use-billing-portal";

/** The band shown when the processor could not collect the subscription payment: what happened, what it costs, and the portal to update the card. */
export function PaymentProblem() {
  const { say } = useSay();
  const { open, pending, problem } = useBillingPortal();
  return (
    <Alert tone="warning" data-testid="payment-problem" title={say("paymentProblem.title")}>
      <p className="m-0">{say("paymentProblem.text")}</p>
      {problem ? <p className="m-0 mt-2 text-fg-danger">{problem}</p> : null}
      <span className="mt-3 flex flex-wrap gap-3">
        <Button size="md" variant="secondary" loading={pending} onClick={() => void open()}>
          {say("paymentProblem.fix")}
        </Button>
      </span>
    </Alert>
  );
}
