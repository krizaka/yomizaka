"use client";

import { krizakaFetch, useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Input } from "@krizaka/ui/field";
import { List } from "@krizaka/ui/list";
import { RadioGroup } from "@krizaka/ui/radio-group";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import { SHARE_DEFAULT_DAYS, SHARE_MAX_DAYS } from "@/lib/owner-report";

import { useFileFacts } from "./FilesView";

/** The expiries offered: the default first, the maximum last (the server enforces the same bounds). */
export const SHARE_CHOICES = [SHARE_DEFAULT_DAYS, 14, SHARE_MAX_DAYS] as const;

const shares = z.object({ shares: z.array(z.object({ id: z.string(), recipient: z.string(), state: z.enum(["live", "expired", "revoked"]), createdAt: z.string(), expiresAt: z.string(), views: z.number() })) });
const created = z.object({ id: z.string(), token: z.string(), expiresAt: z.string() });

/** The owner link of a file's report (yomizaka#128): create it with an expiry, copy it, see the active links with their views, revoke one. */
export function OwnerShare({ fileId, origin }: Readonly<{ fileId: string; origin?: string }>) {
  const { say, locale } = useSay();
  const facts = useFileFacts();
  const client = useQueryClient();
  const base = `/api/applications/${fileId}/report-shares`;
  const key = ["owner-shares", fileId];
  const [days, setDays] = useState<number>(SHARE_DEFAULT_DAYS);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const list = useQuery({ queryKey: key, queryFn: () => krizakaFetch(base, { schema: shares }) });
  const create = useMutation({ mutationFn: () => krizakaFetch(base, { method: "POST", json: { days }, schema: created }) });
  const revoke = useMutation({ mutationFn: (shareId: string) => krizakaFetch(base, { method: "DELETE", json: { shareId } }) });
  const fail = (error: unknown) => setProblem(say(`errors.${errorKey(error)}`));
  const make = async () => {
    setProblem(null);
    setCopied(false);
    try {
      const made = await create.mutateAsync();
      setLink(`${origin ?? window.location.origin}/${locale}/rapport/${made.token}`);
      await client.invalidateQueries({ queryKey: key });
    } catch (error) {
      fail(error);
    }
  };
  const remove = async (shareId: string) => {
    setProblem(null);
    try {
      await revoke.mutateAsync(shareId);
      await client.invalidateQueries({ queryKey: key });
    } catch (error) {
      fail(error);
    }
  };
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const live = (list.data?.shares ?? []).filter((s) => s.state === "live");
  return (
    <section aria-labelledby="owner-share-title" className="flex flex-col gap-3" data-testid="owner-share">
      <h2 id="owner-share-title" className="m-0 text-lg font-bold text-fg">{say("dossiers.share.title")}</h2>
      <p className="m-0 text-sm text-fg-secondary">{say("dossiers.share.lead")}</p>
      {/* @ephemeral: the expiry of the link about to be created, a form choice, not a view of the page */}
      <RadioGroup.Root variant="segmented" label={say("dossiers.share.expiry")} value={String(days)} onValueChange={(v: string) => setDays(Number(v))}>
        {SHARE_CHOICES.map((d) => (
          <RadioGroup.Segment key={d} value={String(d)}>{say("dossiers.share.days", { count: d })}</RadioGroup.Segment>
        ))}
      </RadioGroup.Root>
      <div>
        <Button variant="secondary" size="md" onClick={() => void make()} disabled={create.isPending}>
          {say(create.isPending ? "dossiers.share.creating" : "dossiers.share.create")}
        </Button>
      </div>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      {link ? (
        <div className="flex flex-col gap-2" data-testid="owner-share-link">
          <p className="m-0 text-sm text-fg-secondary" role="status">{say("dossiers.share.created")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly aria-label={say("dossiers.share.linkLabel")} value={link} className="min-w-0 flex-1" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="secondary" size="md" onClick={() => void copy()}>{say(copied ? "dossiers.share.copied" : "dossiers.share.copy")}</Button>
          </div>
        </div>
      ) : null}
      <h3 className="m-0 text-base font-bold text-fg">{say("dossiers.share.active")}</h3>
      {list.isPending ? (
        <p className="m-0 text-sm text-fg-secondary">{say("dossiers.share.loading")}</p>
      ) : live.length ? (
        <List
          aria-label={say("dossiers.share.active")}
          items={live}
          getId={(s) => s.id}
          row={(s) => ({
            title: say("dossiers.share.expires", { date: facts.date(s.expiresAt) }),
            description: (
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone="success">{say("dossiers.share.state.live")}</Badge>
                <span>{say(s.views === 1 ? "dossiers.share.viewsOne" : "dossiers.share.views", { count: s.views })}</span>
              </span>
            ),
            actions: <Button variant="ghost" size="sm" onClick={() => void remove(s.id)} disabled={revoke.isPending}>{say("dossiers.share.revoke")}</Button>,
          })}
        />
      ) : (
        <p className="m-0 text-sm text-fg-secondary">{say("dossiers.share.none")}</p>
      )}
    </section>
  );
}
