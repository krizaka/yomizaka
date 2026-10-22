import { Card } from "@krizaka/ui/card";
import { DOCUMENT_KINDS, DOCUMENT_STATUSES, type DocumentSummary } from "@yomizaka/core";
import Link from "next/link";

import { DocumentTable } from "@/components/console/DocumentTable";
import { DocumentUploader } from "@/components/console/DocumentUploader";
import { CreateButton, ItemMenu } from "@/components/console/OrganisationActions";
import { TagChips, TagFilter, ValueFilter } from "@/components/console/TagChips";
import type { Messages } from "@/lib/i18n";
import { libraryPath, toggleTag, viewHref,type ViewState } from "@/lib/organisation/rules";
import type { Folder, Tag } from "@/lib/organisation/store";

type Say = Messages["console"]["organisation"];

/**
 * A collection, one of its folders, or « Sans collection »: the breadcrumb, the tag filter (the URL's `?tags=`), the folders,
 * the files, and a drop zone that files into this place. Rendered on the server; the actions are client islands.
 */
export function PlaceView({ locale, t, library, collection, folder, folders, documents, tags, view, labels, tagsByDocument, folderTags, collections, collectionTags, path }: {
  locale: "en" | "fr";
  t: Say;
  library: { id: string; name: string };
  collection?: { id: string; name: string };
  folder?: { id: string; name: string };
  folders: (Folder & { files: number; tags: Tag[] })[];
  documents: DocumentSummary[];
  tags: Tag[];
  view: ViewState;
  /** The words of the kinds and the states (messages `kinds.*`, `statuses.*`). */
  labels: { kinds: Record<string, string>; statuses: Record<string, string> };
  tagsByDocument: Record<string, Tag[]>;
  folderTags?: Record<string, string[]>;
  collections: { id: string; name: string }[];
  collectionTags: string[];
  path: string;
}) {
  const crumbs = [
    { href: `/${locale}/app`, label: t.library },
    ...(collection ? [{ href: libraryPath(locale, library.id, collection.id), label: collection.name }] : [{ href: path, label: t.unfiled }]),
    ...(folder && collection ? [{ href: libraryPath(locale, library.id, collection.id, folder.id), label: folder.name }] : []),
  ];
  const count = (n: number, one: string, many: string) => (n === 1 ? one : many).replace("{count}", String(n));
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-fg-secondary">
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {i === crumbs.length - 1 ? <span aria-current="page" className="font-semibold text-fg">{c.label}</span> : <Link href={c.href} className="hover:text-fg-accent hover:underline">{c.label}</Link>}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 font-display text-xl font-bold text-fg">{folder?.name ?? collection?.name ?? t.unfiled}</h2>
        <div className="flex flex-wrap items-center gap-3">
          {collection && !folder ? <CreateButton kind="folder" parentId={collection.id} /> : null}
          {collection && !folder ? <ItemMenu kind="collection" id={collection.id} name={collection.name} collections={collections} tags={tags} current={collectionTags} /> : null}
        </div>
      </div>
      <TagFilter tags={tags} selected={view.tags} label={t.filterTags} clearLabel={t.clearTags} clearHref={viewHref(path, { ...view, tags: [] })} hrefFor={(id) => viewHref(path, { ...view, tags: toggleTag(view.tags, id) })} />
      <ValueFilter label={t.filterKind} options={DOCUMENT_KINDS.map((k) => ({ value: k, label: labels.kinds[k] ?? k }))} selected={view.kind} hrefFor={(v) => viewHref(path, { ...view, kind: v as ViewState["kind"] })} />
      <ValueFilter label={t.filterStatus} options={DOCUMENT_STATUSES.map((s) => ({ value: s, label: labels.statuses[s] ?? s }))} selected={view.status} hrefFor={(v) => viewHref(path, { ...view, status: v as ViewState["status"] })} />
      {collection && !folder && folders.length > 0 ? (
        <section aria-label={t.foldersIn} className="flex flex-col gap-3">
          <h3 className="m-0 text-sm font-semibold text-fg">{t.foldersIn}</h3>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((f) => (
              <li key={f.id}>
                <Card.Root className="flex h-full flex-col gap-2 p-4" data-testid="folder-card">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={libraryPath(locale, library.id, collection.id, f.id)} className="font-semibold text-fg hover:text-fg-accent hover:underline">
                      {f.name}
                    </Link>
                    <ItemMenu kind="folder" id={f.id} name={f.name} collections={collections} folders={folders.map((x) => ({ id: x.id, name: x.name }))} tags={tags} current={folderTags?.[f.id] ?? []} />
                  </div>
                  <p className="m-0 text-sm text-fg-secondary">{count(f.files, t.filesOne, t.filesMany)}</p>
                  <TagChips tags={f.tags} />
                </Card.Root>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-label={t.filesIn} className="flex flex-col gap-3">
        <h3 className="m-0 text-sm font-semibold text-fg">{t.filesIn}</h3>
        {documents.length > 0 ? (
          <DocumentTable rows={documents} organise={{ collections, folders: folders.map((f) => ({ id: f.id, name: f.name })), collectionId: collection?.id ?? null, tags, tagsByDocument }} />
        ) : (
          <p className="m-0 text-sm text-fg-secondary">{t.emptyCollection}</p>
        )}
        <DocumentUploader placement={{ collectionId: collection?.id ?? null, folderId: folder?.id ?? null }} />
      </section>
    </div>
  );
}
