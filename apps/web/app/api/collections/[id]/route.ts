import { documentsByIds } from "@/lib/documents";
import { act, type Params } from "@/lib/organisation/api";
import { containerHandlers } from "@/lib/organisation/handlers";
import { isId, parseTagsParam } from "@/lib/organisation/rules";
import { browse, foldersOf, ownedCollection } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

/** A collection's folders and files (`?folder=<id>` for one folder, `?tags=a,b` keeps the files that carry all of them). */
export const GET = (req: Request, { params }: Params) =>
  act(req, async ({ owner, q }) => {
    const id = (await params).id;
    const url = new URL(req.url);
    const folder = url.searchParams.get("folder");
    await ownedCollection(q, owner, id);
    const { documentIds } = await browse(q, owner, { collectionId: id, folderId: folder && isId(folder) ? folder : undefined, tagIds: parseTagsParam(url.searchParams.get("tags") ?? undefined) });
    return { folders: await foldersOf(q, owner, id), documents: await documentsByIds(owner, documentIds) };
  });

export const { PATCH, DELETE } = containerHandlers("collection");
