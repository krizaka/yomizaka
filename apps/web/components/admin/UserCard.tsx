"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import Link from "next/link";
import { useState } from "react";

import type { UserDetail } from "@/lib/admin";
import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

import { formatDate } from "../console/format";
import { UserActions } from "./UserActions";

/** One account and the one action an administrator takes on it: suspend (every session ends) or restore. */
export function UserCard({ initial }: Readonly<{ initial: UserDetail }>) {
  const { say, locale } = useSay();
  const [user, setUser] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: (to: "suspend" | "restore") => krizakaFetch(`/api/admin/users/${user.id}/${to}`, { method: "POST" }) as Promise<{ user: UserDetail }>,
    onSuccess: (r) => {
      setUser(r.user);
      setConfirming(false);
      setProblem(null);
    },
    onError: (e) => setProblem(say(`errors.${errorKey(e)}`)),
  });
  return (
    <Card.Root className="flex flex-col gap-4 p-4">
      <Link href={`/${locale}/users`} className="text-sm text-fg-muted hover:text-fg">
        ← {say("adminConsole.user.back")}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="break-all font-display text-xl font-extrabold text-fg">{user.email}</h2>
        {user.status === "ACTIVE" ? (
          confirming ? (
            <Button variant="danger" size="sm" loading={change.isPending} onClick={() => change.mutate("suspend")}>
              {say("adminConsole.user.suspendConfirm")}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
              {say("adminConsole.user.suspend")}
            </Button>
          )
        ) : (
          <Button variant="primary" size="sm" loading={change.isPending} onClick={() => change.mutate("restore")}>
            {say("adminConsole.user.restore")}
          </Button>
        )}
      </div>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <DescriptionList
        items={[
          { term: say("adminConsole.user.role"), details: <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{say(`admin.roles.${user.role}`)}</Badge> },
          { term: say("adminConsole.user.status"), details: <Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>{say(`admin.states.${user.status}`)}</Badge> },
          { term: say("adminConsole.user.documents"), details: String(user.documents) },
          { term: say("adminConsole.user.sessions"), details: String(user.sessions) },
          { term: say("adminConsole.user.created"), details: formatDate(user.createdAt, locale, true) },
          { term: say("adminConsole.user.lastSeen"), details: user.lastSeenAt ? formatDate(user.lastSeenAt, locale, true) : say("admin.never") },
        ]}
      />
      <UserActions user={user} onChange={setUser} />
    </Card.Root>
  );
}
