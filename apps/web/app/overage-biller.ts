import { PAYMENTS_CODE, PaymentsError } from "@krizaka/payments";

import { env } from "@/lib/env";
import type { OverageBiller } from "@/lib/overage";
import { paymentsFrom } from "@/lib/payments/config";

// The processor's tax code of the service, the same as the plans' in `deploy/payments-catalogue.json`.
const TAX_CODE = "txcd_10103001";
const CURRENCY = "cad";

/** The overage biller on the configured processor, or null while payments are off (an overage is then never charged: the account waits). */
export function overageBiller(): OverageBiller | null {
  const port = paymentsFrom(env());
  if (!port) {
    return null;
  }
  return {
    async charge({ key, customerId, amountMinor, description }) {
      const { ref } = await port.charge({
        key,
        customerId,
        amountMinor,
        currency: CURRENCY,
        description,
        taxCode: TAX_CODE,
      });
      return { ref };
    },
    async refund(ref, key) {
      await port.refund(ref, { key });
    },
    isDeclined: (error) => error instanceof PaymentsError && error.code === PAYMENTS_CODE.declined,
  };
}
