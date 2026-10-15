"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Field, Input } from "@krizaka/ui/field";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { UserDetail } from "@/lib/admin";
import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

/** The rest of what an administrator does to an account: the role, the sessions, Law 25 export and erasure. */
export function UserActions({ user, onChange }: { user: UserDetail; onChange: (user: UserDetail) => void }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const fail = (e: unknown) => {
    setNote(null);
    setProblem(say(`errors.${errorKey(e)}`));
  };
  const role = useMutation({
    mutationFn: () => krizakaFetch(`/api/admin/users/${user.id}/role`, { method: "POST", json: { role: user.role === "ADMIN" ? "USER" : "ADMIN" } }) as Promise<{ user: UserDetail }>,
    onSuccess: (r) => {
      onChange(r.user);
      setProblem(null);
    },
    onError: fail,
  });
  const revoke = useMutation({
    mutationFn: () => krizakaFetch(`/api/admin/users/${user.id}/sessions`, { method: "DELETE" }) as Promise<{ revoked: number; user: UserDetail }>,
    onSuccess: (r) => {
      onChange(r.user);
      setProblem(null);
      setNote(say("adminConsole.user.sessionsRevoked", { count: r.revoked }));
    },
    onError: fail,
  });
  const erase = useMutation({
    mutationFn: () => krizakaFetch(`/api/admin/users/${user.id}`, { method: "DELETE", json: { confirmEmail: confirm } }),
    onSuccess: () => router.push(`/${locale}/users`),
    onError: fail,
  });
  return (
    <div className="flex flex-col gap-4">
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      {note ? <Alert tone="success">{note}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" loading={role.isPending} onClick={() => role.mutate()}>
          {say(user.role === "ADMIN" ? "adminConsole.user.makeUser" : "adminConsole.user.makeAdmin")}
        </Button>
        <Button variant="secondary" size="sm" loading={revoke.isPending} onClick={() => revoke.mutate()}>
          {say("adminConsole.user.revokeSessions")}
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <a href={`/api/admin/users/${user.id}/export`} download>
            {say("adminConsole.user.exportData")}
          </a>
        </Button>
      </div>
      <section className="flex flex-col gap-2 border-t border-border-subtle pt-4" aria-label={say("adminConsole.user.dangerTitle")}>
        <h3 className="font-display text-sm font-bold text-fg">{say("adminConsole.user.dangerTitle")}</h3>
        <p className="text-sm text-fg-secondary">{say("adminConsole.user.dangerLead")}</p>
        <Field.Root>
          <Field.Label htmlFor="confirm-email">{say("adminConsole.user.confirmLabel")}</Field.Label>
          <Input id="confirm-email" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} />
        </Field.Root>
        <div>
          <Button variant="danger" size="sm" loading={erase.isPending} disabled={confirm.trim().toLowerCase() !== user.email} onClick={() => erase.mutate()}>
            {say("adminConsole.user.deleteAccount")}
          </Button>
        </div>
      </section>
    </div>
  );
}
