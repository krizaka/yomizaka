"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

const forgot = createKrizakaForm({
  schema: z.object({ email: z.string().trim().min(1).email() }),
  defaultValues: { email: "" },
});

/** The address, on @krizaka/ui's form. The answer is the same for every address: « if it has an account, a link is on its way ». */
export function ForgotPasswordForm({ minutes }: Readonly<{ minutes: number }>) {
  const { say, locale } = useSay();
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const request = useMutation({
    mutationFn: (body: { email: string }) => krizakaFetch("/api/auth/forgot-password", { method: "POST", json: body }),
  });
  const form = forgot.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      setProblem(null);
      try {
        await request.mutateAsync(values);
        setSent(true);
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  });
  if (sent)
    return (
      <Alert tone="success" title={say("forgotPassword.sentTitle")}>
        {say("forgotPassword.sent", { minutes })}
      </Alert>
    );
  return (
    <form.Form aria-label={say("forgotPassword.title")} className="flex flex-col gap-4">
      <form.TextField name="email" label={say("forgotPassword.email")} type="email" autoComplete="username" />
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <form.Submit size="lg" shimmer className="w-full">
        {say("forgotPassword.submit")}
      </form.Submit>
    </form.Form>
  );
}
