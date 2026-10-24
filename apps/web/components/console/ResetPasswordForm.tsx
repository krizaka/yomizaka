"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

const reset = createKrizakaForm({
  schema: z
    .object({ password: z.string().min(PASSWORD_MIN_LENGTH, "resetPassword.tooShort"), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "resetPassword.mismatch" }),
  defaultValues: { password: "", confirm: "" },
});

/** The new password twice, on @krizaka/ui's form. The server ends every session; the person is then sent to sign in. */
export function ResetPasswordForm({ token }: { token: string }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const request = useMutation({ mutationFn: (body: { token: string; password: string }) => krizakaFetch("/api/auth/reset-password", { method: "POST", json: body }) });
  const form = reset.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      setProblem(null);
      try {
        await request.mutateAsync({ token, password: values.password });
        router.replace(`/${locale}/sign-in?reset=1`);
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  });
  return (
    <form.Form aria-label={say("resetPassword.title")} className="flex flex-col gap-4">
      <form.TextField name="password" label={say("resetPassword.password")} type="password" autoComplete="new-password" />
      <form.TextField name="confirm" label={say("resetPassword.confirm")} type="password" autoComplete="new-password" />
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <form.Submit size="lg" shimmer className="w-full">
        {say("resetPassword.submit")}
      </form.Submit>
    </form.Form>
  );
}
