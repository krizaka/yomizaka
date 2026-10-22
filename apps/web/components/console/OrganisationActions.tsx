"use client";

import { MoreIcon } from "@krizaka/icons";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button, IconButton } from "@krizaka/ui/button";
import { Dialog } from "@krizaka/ui/dialog";
import { DropdownMenu } from "@krizaka/ui/dropdown-menu";
import { createKrizakaForm } from "@krizaka/ui/form";
import { RadioGroup } from "@krizaka/ui/radio-group";
import { TagSelector } from "@krizaka/ui/tag-selector";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import { TAG_COLORS, type TagColor } from "@/lib/organisation/rules";

/** The creating, renaming, moving, tagging and deleting of the organisation (ADR-0007): each a call to its route, then the page refreshes. */
export type Option = { id: string; name: string };
export type TagOption = Option & { color: TagColor };

const nameForm = createKrizakaForm({ schema: z.object({ name: z.string().trim().min(1).max(80) }), defaultValues: { name: "" } });

function useAction<T>(run: (input: T) => Promise<unknown>, done: () => void) {
  const { say } = useSay();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const mutation = useMutation({ mutationFn: run });
  return {
    problem,
    pending: mutation.isPending,
    clear: () => setProblem(null),
    go: async (input: T) => {
      setProblem(null);
      try {
        await mutation.mutateAsync(input);
        done();
        router.refresh();
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  };
}

function Frame({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode }) {
  const { say } = useSay();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content closeLabel={say("organisation.cancel")}>
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
          {description ? <Dialog.Description>{description}</Dialog.Description> : null}
        </Dialog.Header>
        <Dialog.Body className="flex flex-col gap-4">{children}</Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/** A name (and, for a tag, a colour): creates or renames. */
function NameDialog({ open, onOpenChange, title, initial = "", color, submit }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; initial?: string; color?: TagColor | null; submit: (name: string, color: TagColor | null) => Promise<unknown> }) {
  const { say, locale } = useSay();
  const [chosen, setChosen] = useState<TagColor>(color ?? "blue");
  const action = useAction<string>((name) => submit(name, color === undefined ? null : chosen), () => onOpenChange(false));
  const form = nameForm.useForm({ i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale }, defaultValues: { name: initial }, onSubmit: (values) => action.go(values.name) });
  return (
    <Frame open={open} onOpenChange={onOpenChange} title={title}>
      <form.Form aria-label={title} className="flex flex-col gap-4">
        <form.TextField name="name" label={say("organisation.name")} maxLength={80} />
        {color === undefined ? null : (
          // @ephemeral: a field of the tag form, saved with it
          <RadioGroup.Root variant="segmented" label={say("organisation.color")} value={chosen} onValueChange={(v: string) => setChosen(v as TagColor)}>
            {TAG_COLORS.map((c) => (
              <RadioGroup.Segment key={c} value={c}>
                {say(`organisation.colors.${c}`)}
              </RadioGroup.Segment>
            ))}
          </RadioGroup.Root>
        )}
        {action.problem ? <Alert tone="danger">{action.problem}</Alert> : null}
        <form.Submit size="md">{say("organisation.save")}</form.Submit>
      </form.Form>
    </Frame>
  );
}

/** Where each kind of item is served. */
const ENDPOINT = { collection: "/api/collections", folder: "/api/folders", document: "/api/documents", tag: "/api/tags" } as const;

/** What each « New … » button creates: where it posts, the field naming its parent, and its message. */
const CREATE = {
  collection: { url: ENDPOINT.collection, parentField: "libraryId", label: "organisation.newCollection" },
  folder: { url: ENDPOINT.folder, parentField: "collectionId", label: "organisation.newFolder" },
  tag: { url: ENDPOINT.tag, parentField: null, label: "organisation.newTag" },
} as const;
type CreateKind = keyof typeof CREATE;

/** « New collection », « New folder », « New tag »: a button and its dialog. */
export function CreateButton({ kind, parentId, variant = "secondary" }: { kind: CreateKind; parentId?: string; variant?: "secondary" | "ghost" }) {
  const { say } = useSay();
  const [open, setOpen] = useState(false);
  const { url, parentField, label: key } = CREATE[kind];
  const label = say(key);
  const submit = (name: string, color: TagColor | null) => krizakaFetch(url, { method: "POST", json: { name, ...(parentField ? { [parentField]: parentId } : { color: color ?? "blue" }) } });
  return (
    <>
      <Button variant={variant} size="md" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? <NameDialog open={open} onOpenChange={setOpen} title={label} color={parentField ? undefined : null} submit={submit} /> : null}
    </>
  );
}

function DefaultDialog({ api, name, onClose }: { api: string; name: string; onClose: () => void }) {
  const { say } = useSay();
  const save = useAction<null>(() => krizakaFetch(api, { method: "PATCH", json: { default: true } }), onClose);
  return (
    <Frame open onOpenChange={onClose} title={say("organisation.makeDefaultTitle", { name })} description={say("organisation.makeDefaultAsk")}>
      {save.problem ? <Alert tone="danger">{save.problem}</Alert> : null}
      <Button size="md" loading={save.pending} onClick={() => save.go(null)}>
        {say("organisation.makeDefault")}
      </Button>
    </Frame>
  );
}

/** What the menu of an item can do. */
export const ITEM_KIND = { collection: "collection", folder: "folder", document: "document" } as const;
export type ItemKind = (typeof ITEM_KIND)[keyof typeof ITEM_KIND];

/** The menu's entries, in order, with the kinds each applies to and its message: one list, one loop. */
const MENU = [
  { action: "rename", label: "organisation.rename", kinds: [ITEM_KIND.collection, ITEM_KIND.folder] },
  { action: "move", label: "organisation.move", kinds: [ITEM_KIND.collection, ITEM_KIND.folder, ITEM_KIND.document] },
  { action: "tags", label: "organisation.editTags", kinds: [ITEM_KIND.collection, ITEM_KIND.folder, ITEM_KIND.document] },
  { action: "default", label: "organisation.makeDefault", kinds: [ITEM_KIND.collection] },
  { action: "delete", label: "organisation.delete", kinds: [ITEM_KIND.collection, ITEM_KIND.folder] },
] as const;
type Action = (typeof MENU)[number]["action"];


/**
 * The menu of a collection, a folder or a document: rename, move, edit tags, delete. A deletion always asks what becomes of
 * the files. `collections` and `folders` are the destinations (the folders of the item's collection); `tags` the owner's tags.
 */
export function ItemMenu({ kind, id, name, isDefault = false, collections = [], folders = [], tags = [], current = [], collectionId = null }: { kind: ItemKind; id: string; name: string; isDefault?: boolean; collections?: Option[]; folders?: Option[]; tags?: TagOption[]; current?: string[]; collectionId?: string | null }) {
  const { say } = useSay();
  const [dialog, setDialog] = useState<Action | null>(null);
  const close = () => setDialog(null);
  const api = `${ENDPOINT[kind]}/${id}`;
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton label={say("organisation.actions", { name })} variant="ghost" size="icon">
            <MoreIcon size={18} />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {MENU.filter((m) => (m.kinds as readonly ItemKind[]).includes(kind) && !(isDefault && (m.action === "delete" || m.action === "default"))).map((m) => (
            <DropdownMenu.Item key={m.action} onSelect={() => setDialog(m.action)}>
              {say(m.label)}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      {dialog === "rename" ? <NameDialog open onOpenChange={close} title={say("organisation.rename")} initial={name} submit={(n) => krizakaFetch(api, { method: "PATCH", json: { name: n } })} /> : null}
      {dialog === "move" ? <MoveDialog kind={kind} id={id} api={api} collections={collections} folders={folders} collectionId={collectionId} onClose={close} /> : null}
      {dialog === "default" ? <DefaultDialog api={api} name={name} onClose={close} /> : null}
      {dialog === "tags" ? <TagsDialog kind={kind} id={id} tags={tags} current={current} onClose={close} /> : null}
      {dialog === "delete" ? <DeleteDialog kind={kind} id={id} name={name} api={api} collections={collections} folders={folders} onClose={close} /> : null}
    </>
  );
}

const DEFAULT = "__default__";
const ROOT = "__root__";

function MoveDialog({ kind, id, api, collections, folders, collectionId, onClose }: { kind: ItemKind; id: string; api: string; collections: Option[]; folders: Option[]; collectionId: string | null; onClose: () => void }) {
  const { say } = useSay();
  const [target, setTarget] = useState<string>("");
  const move = useAction<string>(async (to) => {
    if (kind === "collection") return krizakaFetch(api, { method: "PATCH", json: { libraryId: to } });
    if (kind === "folder") return krizakaFetch(api, { method: "PATCH", json: { collectionId: to } });
    const [c, f] = to.split("|");
    return krizakaFetch(`${api}/placement`, { method: "PUT", json: { collectionId: c === DEFAULT ? null : c, folderId: f && f !== ROOT ? f : null } });
  }, onClose);
  // A document goes to a collection (its root) or to a folder of its own collection; a folder to another collection.
  const options: Option[] =
    kind === "document"
      ? [{ id: `${DEFAULT}|`, name: say("organisation.defaultCollection") }, ...collections.map((c) => ({ id: `${c.id}|${ROOT}`, name: c.name })), ...(collectionId ? folders.map((f) => ({ id: `${collectionId}|${f.id}`, name: `${say("organisation.foldersIn")}: ${f.name}` })) : [])]
      : collections.filter((c) => c.id !== id);
  return (
    <Frame open onOpenChange={onClose} title={say("organisation.move")}>
      <RadioGroup.Root label={say("organisation.moveTo")} value={target} onValueChange={setTarget}>
        {options.map((o) => (
          <RadioGroup.Item key={o.id} value={o.id}>
            {o.name}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {move.problem ? <Alert tone="danger">{move.problem}</Alert> : null}
      <Button size="md" disabled={!target} loading={move.pending} onClick={() => move.go(target)}>
        {say("organisation.move")}
      </Button>
    </Frame>
  );
}

function TagsDialog({ kind, id, tags, current, onClose }: { kind: ItemKind; id: string; tags: TagOption[]; current: string[]; onClose: () => void }) {
  const { say } = useSay();
  const [value, setValue] = useState<string[]>(current);
  const save = useAction<string[]>((tagIds) => krizakaFetch("/api/tags/assign", { method: "PUT", json: { kind, id, tagIds } }), onClose);
  return (
    <Frame open onOpenChange={onClose} title={say("organisation.editTags")}>
      {tags.length === 0 ? <p className="m-0 text-sm text-fg-secondary">{say("organisation.noTags")}</p> : <TagSelector label={say("organisation.editTags")} options={tags.map((t) => ({ value: t.id, label: t.name }))} value={value} onValueChange={setValue} max={20} />}
      {save.problem ? <Alert tone="danger">{save.problem}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        <Button size="md" loading={save.pending} onClick={() => save.go(value)}>
          {say("organisation.save")}
        </Button>
        <CreateButton kind="tag" variant="ghost" />
      </div>
    </Frame>
  );
}

function DeleteDialog({ kind, id, name, api, collections, folders, onClose }: { kind: ItemKind; id: string; name: string; api: string; collections: Option[]; folders: Option[]; onClose: () => void }) {
  const { say } = useSay();
  const [files, setFiles] = useState<"move" | "delete">("move");
  const [to, setTo] = useState<string>(kind === "folder" ? ROOT : DEFAULT);
  const remove = useAction<null>(() => krizakaFetch(api, { method: "DELETE", json: { files, to: files === "move" && to !== ROOT && to !== DEFAULT ? to : null } }), onClose);
  const destinations: Option[] =
    kind === "folder"
      ? [{ id: ROOT, name: say("organisation.moveUpFolder") }, ...folders.filter((f) => f.id !== id)]
      : [{ id: DEFAULT, name: say("organisation.moveToDefault") }, ...collections.filter((c) => c.id !== id)];
  return (
    <Frame open onOpenChange={onClose} title={say("organisation.deleteTitle", { name })} description={say("organisation.deleteAsk")}>
      <RadioGroup.Root label={say("organisation.deleteAsk")} value={files} onValueChange={(v: string) => setFiles(v as "move" | "delete")}>
        <RadioGroup.Item value="move">{say("organisation.deleteMove")}</RadioGroup.Item>
        <RadioGroup.Item value="delete">{say("organisation.deleteDocs")}</RadioGroup.Item>
      </RadioGroup.Root>
      {files === "move" ? (
        <RadioGroup.Root label={say("organisation.moveTo")} value={to} onValueChange={setTo}>
          {destinations.map((d) => (
            <RadioGroup.Item key={d.id} value={d.id}>
              {d.name}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      ) : null}
      {remove.problem ? <Alert tone="danger">{remove.problem}</Alert> : null}
      <Button size="md" variant="danger" loading={remove.pending} onClick={() => remove.go(null)}>
        {say("organisation.delete")}
      </Button>
    </Frame>
  );
}
