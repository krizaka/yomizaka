"use client";

import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { Mascot } from "@krizaka/ui/mascots";
import { type Audience, type DocumentSummary } from "@yomizaka/core";
import Link from "next/link";

import { useSay } from "@/lib/i18n-client";
import { libraryScreen } from "@/lib/library-screen";
import { libraryPath } from "@/lib/organisation/rules";
import type { LibraryOverview } from "@/lib/organisation/store";
import { pluralKey } from "@/lib/plural";

import { DocumentTable } from "./DocumentTable";
import { DocumentUploader } from "./DocumentUploader";
import { CreateButton, ItemMenu, type TagOption } from "./OrganisationActions";
import { TagChips } from "./TagChips";

export type ExampleDocuments = Record<"tenant" | "landlord", { title: string; filename: string; text: string }>;

/**
 * The library's first screen (ADR-0007): the person's libraries and their collections, then « Récents » — and, when there is
 * nothing yet, a drop zone with examples. One primary action (check a document), the tenant file only where the role is offered it.
 */
export function LibraryView({ libraries, recents, tags, perspective = null, screening = false, examples }: { libraries: LibraryOverview[]; recents: DocumentSummary[]; tags: TagOption[]; perspective?: Audience | null; screening?: boolean; examples?: ExampleDocuments }) {
  const { say, locale } = useSay();
  const collections = libraries.flatMap((l) => l.collections);
  const screen = libraryScreen({ documents: recents.length + collections.length, screening });
  const order = (perspective === "landlord" ? ["landlord", "tenant"] : ["tenant", "landlord"]) as ("tenant" | "landlord")[];
  const first = libraries[0];
  const destinations = collections.map((c) => ({ id: c.id, name: c.name }));
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-end gap-3" data-testid="library-actions">
        {first ? <CreateButton kind="collection" parentId={first.id} /> : null}
        {screen.secondary ? (
          <Button asChild variant="secondary" size="md">
            <Link href={`/${locale}${screen.secondary}`}>{say("library.screeningCta")}</Link>
          </Button>
        ) : null}
        <Button asChild variant="primary" size="md">
          <Link href={`/${locale}${screen.primary}`}>{say("library.checkCta")}</Link>
        </Button>
      </div>

      {screen.table || collections.length > 0 ? (
        <>
          {libraries.map((lib) => (
            <section key={lib.id} className="flex flex-col gap-3" aria-label={lib.name} data-testid="library-section">
              <h2 className="m-0 font-display text-lg font-bold text-fg">{libraries.length > 1 ? lib.name : say("organisation.collections")}</h2>
              {lib.collections.length === 0 ? <p className="m-0 text-sm text-fg-secondary">{say("organisation.noCollections")}</p> : null}
              <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {lib.collections.map((c) => (
                  <li key={c.id}>
                    <Card.Root className="flex h-full flex-col gap-2 p-4" data-testid="collection-card">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={libraryPath(locale, lib.id, c.id)} className="font-semibold text-fg hover:text-fg-accent hover:underline">
                          {c.name}
                        </Link>
                        {c.isDefault ? <Badge tone="neutral" size="sm">{say("organisation.default")}</Badge> : null}
                        <ItemMenu kind="collection" id={c.id} name={c.name} isDefault={c.isDefault} collections={destinations} tags={tags} current={c.tags.map((t) => t.id)} />
                      </div>
                      <p className="m-0 text-sm text-fg-secondary">
                        {say(pluralKey("organisation.files", c.files), { count: c.files })}
                        {c.folders > 0 ? ` · ${say(pluralKey("organisation.folders", c.folders), { count: c.folders })}` : ""}
                      </p>
                      <TagChips tags={c.tags} />
                    </Card.Root>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {recents.length > 0 ? (
            <section className="flex flex-col gap-3" aria-label={say("organisation.recents")}>
              <h2 className="m-0 font-display text-lg font-bold text-fg">{say("organisation.recents")}</h2>
              <DocumentTable rows={recents} />
            </section>
          ) : null}
        </>
      ) : (
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-4" aria-label={say("library.emptyTitle")} data-testid="library-empty">
          <div className="flex flex-col items-center gap-2 text-center">
            <Mascot bird="owl" mood="empty" size={176} />
            <h2 className="m-0 font-display text-xl font-bold text-fg">{say("library.emptyTitle")}</h2>
            <p className="m-0 max-w-xl text-sm text-fg-secondary">{say("library.emptyText")}</p>
          </div>
          <DocumentUploader
            extra={(add) =>
              examples ? (
                <div className="flex flex-col gap-3 pt-2" data-testid="library-examples">
                  <h3 className="m-0 text-sm font-semibold text-fg">{say("library.examplesTitle")}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {order.map((role) => (
                      <Card.Root key={role} className="flex flex-col gap-2 p-4">
                        <span className="font-semibold text-fg">{say(role === "tenant" ? "library.exampleTenant" : "library.exampleLandlord")}</span>
                        <span className="text-sm text-fg-secondary">{say(role === "tenant" ? "library.exampleTenantHint" : "library.exampleLandlordHint")}</span>
                        <div>
                          <Button variant="secondary" size="sm" onClick={() => add([new File([examples[role].text], examples[role].filename, { type: "text/plain" })])}>
                            {say("library.tryExample")}
                          </Button>
                        </div>
                      </Card.Root>
                    ))}
                  </div>
                  <p className="m-0 text-xs text-fg-muted">{say("library.examplesNote")}</p>
                </div>
              ) : null
            }
          />
        </section>
      )}
    </div>
  );
}
