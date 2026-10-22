import { notFound, redirect } from "next/navigation";

import { PlaceView } from "@/components/console/PlaceView";
import { pageSession } from "@/lib/access";
import { query } from "@/lib/db";
import { documentsByIds } from "@/lib/documents";
import { asLocale, getDictionary } from "@/lib/i18n";
import { applyFilters, isId, libraryPath, parseView } from "@/lib/organisation/rules";
import * as org from "@/lib/organisation/store";

type Props = { params: Promise<{ locale: string; library?: string; collection?: string; folder?: string }>; searchParams: Promise<{ tags?: string | string[]; kind?: string; status?: string }>; unfiled?: boolean };

/** A collection, a folder or « Sans collection », read on the server from the URL: `/app/bibliotheque/[library]/[collection]/[folder]?tags=`. */
export async function PlacePage({ params, searchParams, unfiled = false }: Props) {
  const p = await params;
  const locale = asLocale(p.locale);
  const session = await pageSession();
  if (!session) redirect(`/${locale}/sign-in`);
  const owner = session.account.id;
  const view = parseView(await searchParams);
  const selected = view.tags;
  const dict = getDictionary(locale).console;
  const t = dict.organisation;
  const labels = { kinds: dict.kinds as Record<string, string>, statuses: dict.statuses as Record<string, string> };
  const tags = await org.listTags(query, owner);
  const overview = await org.overview(query, owner);
  const collections = overview.flatMap((l) => l.collections).map((c) => ({ id: c.id, name: c.name }));

  if (unfiled) {
    const lib = overview[0] ?? (await org.ensureLibrary(query, owner, t.library));
    const docs = (await documentsByIds(owner, await org.unfiledIds(query, owner))).filter(Boolean);
    const byDoc = await org.tagsOf(query, owner, "document", docs.map((d) => d.id));
    const shown = applyFilters(selected.length ? docs.filter((d) => selected.every((s) => byDoc.get(d.id)?.some((x) => x.id === s))) : docs, view);
    return <PlaceView locale={locale} t={t} library={{ id: lib.id, name: lib.name }} folders={[]} documents={shown} tags={tags} view={view} labels={labels} tagsByDocument={Object.fromEntries(byDoc)} collections={collections} collectionTags={[]} path={`/${locale}/app/bibliotheque/sans-collection`} />;
  }

  if (!isId(p.library) || !isId(p.collection)) notFound();
  const collection = await org.ownedCollection(query, owner, p.collection).catch(() => null);
  if (!collection || collection.library_id !== p.library) notFound();
  const folder = p.folder ? await org.ownedFolder(query, owner, p.folder).catch(() => null) : undefined;
  if (p.folder && (!folder || folder.collection_id !== collection.id)) notFound();
  const folders = await org.foldersOf(query, owner, collection.id);
  const ids = (await org.browse(query, owner, { collectionId: collection.id, folderId: folder?.id, tagIds: selected })).documentIds;
  const documents = applyFilters(await documentsByIds(owner, ids), view);
  const byDoc = await org.tagsOf(query, owner, "document", ids);
  const collTags = await org.tagsOf(query, owner, "collection", [collection.id]);
  const lib = overview.find((l) => l.id === collection.library_id);
  if (!lib) notFound();
  return (
    <PlaceView
      locale={locale}
      t={t}
      library={{ id: lib.id, name: lib.name }}
      collection={{ id: collection.id, name: collection.name }}
      folder={folder ? { id: folder.id, name: folder.name } : undefined}
      folders={folders}
      documents={documents}
      tags={tags}
      view={view}
      labels={labels}
      tagsByDocument={Object.fromEntries(byDoc)}
      folderTags={Object.fromEntries(folders.map((f) => [f.id, f.tags.map((x) => x.id)]))}
      collections={collections}
      collectionTags={(collTags.get(collection.id) ?? []).map((x) => x.id)}
      path={libraryPath(locale, lib.id, collection.id, folder?.id)}
    />
  );
}
