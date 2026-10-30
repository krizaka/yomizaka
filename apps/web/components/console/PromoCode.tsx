"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Field, Input } from "@krizaka/ui/field";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import type { SoldKind } from "@/lib/pricing";

const effect = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("discount"),
    percentOffBp: z.number().nullable(),
    amountOffMinor: z.number().nullable(),
    currency: z.string().nullable(),
    duration: z.enum(["once", "repeating", "forever"]),
    durationMonths: z.number().nullable(),
  }),
  z.object({ kind: z.literal("credit"), credits: z.number() }),
]);
const checked = z.object({ coupon: z.object({ code: z.string(), kind: z.string() }), effect });
const redeemed = z.object({ credits: z.number(), expiresAt: z.string() });

// @fixed: basis points in a percent
const BP_PER_PERCENT = 100;
// @fixed: minor units in a major unit of the product's currency (CAD)
const CENTS = 100;

/**
 * « Promo code » (ADR-002 §6.2): a field and « Apply ». A discount code is checked against the purchase and then sent with the checkout (the server checks it again
 * and reserves the use); a credit code is redeemed on the spot, which grants its credits. Refusals are worded by their code (`errors.COUPON_*`).
 * `onCode` gives the parent the code to send with « Pay » (null once removed).
 */
export function PromoCode({
  kind,
  onCode,
  onRedeemed,
}: Readonly<{ kind: SoldKind; onCode: (code: string | null) => void; onRedeemed?: () => void }>) {
  const { say, locale } = useSay();
  const [typed, setTyped] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const check = useMutation({
    mutationFn: async (code: string) => {
      try {
        return {
          code,
          found: await krizakaFetch("/api/billing/coupon", { method: "POST", json: { code, kind }, schema: checked }),
        };
      } catch (error) {
        if (errorKey(error) !== "COUPON_KIND") throw error;
        // a credit code: redeemed here, not at the checkout
        return {
          code,
          credit: await krizakaFetch("/api/billing/coupon/redeem", {
            method: "POST",
            json: { code },
            schema: redeemed,
          }),
        };
      }
    },
    onSuccess: (result) => {
      setProblem(null);
      if ("credit" in result && result.credit) {
        setApplied(
          say("promo.credited", {
            credits: result.credit.credits,
            date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(result.credit.expiresAt)),
          }),
        );
        onRedeemed?.();
        setTyped("");
        return;
      }
      if ("found" in result && result.found.effect.kind === "discount") {
        const e = result.found.effect;
        const amount =
          e.percentOffBp === null
            ? new Intl.NumberFormat(locale, {
                style: "currency",
                currency: (e.currency ?? "cad").toUpperCase(),
              }).format((e.amountOffMinor ?? 0) / CENTS)
            : `${e.percentOffBp / BP_PER_PERCENT} %`;
        setApplied(
          say("promo.applied", {
            code: result.found.coupon.code,
            discount: amount,
            duration: say(`promo.duration.${e.duration}`, { months: e.durationMonths ?? 0 }),
          }),
        );
        onCode(result.code);
      }
    },
    onError: (error) => {
      setApplied(null);
      onCode(null);
      setProblem(say(`errors.${errorKey(error)}`));
    },
  });
  const remove = () => {
    setApplied(null);
    setTyped("");
    onCode(null);
  };
  return (
    <div className="flex flex-col gap-2" data-testid="promo-code">
      {applied ? (
        <div className="flex flex-wrap items-center gap-3">
          <output className="m-0 block text-sm font-semibold">{applied}</output>
          <Button variant="ghost" size="sm" onClick={remove}>
            {say("promo.remove")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Field.Root>
            <Field.Label htmlFor="promo-code">{say("promo.label")}</Field.Label>
            <Input
              id="promo-code"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && typed.trim() && check.mutate(typed.trim())}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={problem ? "promo-problem" : undefined}
            />
          </Field.Root>
          <Button
            variant="secondary"
            size="md"
            loading={check.isPending}
            disabled={!typed.trim()}
            onClick={() => check.mutate(typed.trim())}
          >
            {say("promo.apply")}
          </Button>
        </div>
      )}
      {problem ? (
        <Alert tone="danger">
          <span id="promo-problem">{problem}</span>
        </Alert>
      ) : null}
    </div>
  );
}
