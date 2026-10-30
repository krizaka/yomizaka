"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { usePathname, useRouter } from "next/navigation";

import { useSay } from "@/lib/i18n-client";
import type { PaymentReturn as Return } from "@/lib/payment-return";
import { useBillingPortal } from "@/lib/use-billing-portal";

/**
 * The band shown when the customer comes back from the processor's checkout: what was bought, that the balance follows the
 * processor's notification (seconds), and where the receipt is (its secure portal, which holds the invoices with GST and QST).
 * A cancelled checkout says nothing was charged. « Close » drops the parameter from the address.
 */
export function PaymentReturn({ result }: Readonly<{ result: Return }>) {
  const { say } = useSay();
  const router = useRouter();
  const path = usePathname();
  const { open, pending, problem } = useBillingPortal();
  const paid = result.state === "paid";
  return (
    <Alert tone={paid ? "success" : "info"} data-testid="payment-return" title={say(paid ? "paymentReturn.paidTitle" : "paymentReturn.cancelledTitle")}>
      <p className="m-0">{say(paid ? `paymentReturn.paid.${result.kind}` : "paymentReturn.cancelled")}</p>
      {problem ? <p className="m-0 mt-2 text-fg-danger">{problem}</p> : null}
      <span className="mt-3 flex flex-wrap gap-3">
        {paid ? (
          <Button size="md" variant="secondary" loading={pending} onClick={() => void open()}>
            {say("paymentReturn.receipt")}
          </Button>
        ) : null}
        <Button size="md" variant="ghost" onClick={() => router.replace(path)}>
          {say("paymentReturn.close")}
        </Button>
      </span>
    </Alert>
  );
}
