"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Dialog } from "@krizaka/ui/dialog";
import { TagSelector } from "@krizaka/ui/tag-selector";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

import { CreateButton } from "../console/OrganisationActions";
import { TagChips } from "../console/TagChips";

type TagOption = { id: string; name: string; color: "blue" | "green" | "amber" | "red" | "violet" | "gray" };

/** The tags of one file, with their markers, and the dialog that sets them (the account's tags of kind « applicant_file »). */
export function FileTags({ fileId, tags, current }: { fileId: string; tags: readonly TagOption[]; current: readonly string[] }) {
  const { say } = useSay();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string[]>([...current]);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({ mutationFn: (tagIds: string[]) => krizakaFetch("/api/organize/applicant_file/tags/set", { method: "PUT", json: { id: fileId, tagIds } }) });
  const worn = tags.filter((t) => current.includes(t.id));
  const submit = async () => {
    setProblem(null);
    try {
      await save.mutateAsync(value);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setProblem(say(`errors.${errorKey(error)}`));
    }
  };
  return (
    <section aria-labelledby="file-tags-title" className="flex flex-col gap-3" data-testid="file-tags">
      <h2 id="file-tags-title" className="m-0 text-lg font-bold text-fg">
        {say("dossiers.tagsEdit.title")}
      </h2>
      {worn.length ? <TagChips tags={worn} /> : <p className="m-0 text-sm text-fg-secondary">{say("dossiers.tagsEdit.none")}</p>}
      <div>
        <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
          {say("dossiers.tagsEdit.edit")}
        </Button>
      </div>
      {open ? (
        <Dialog.Root open onOpenChange={setOpen}>
          <Dialog.Content closeLabel={say("organisation.cancel")}>
            <Dialog.Header>
              <Dialog.Title>{say("dossiers.tagsEdit.edit")}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body className="flex flex-col gap-4">
              {tags.length === 0 ? <p className="m-0 text-sm text-fg-secondary">{say("dossiers.tagsEdit.empty")}</p> : <TagSelector label={say("dossiers.tagsEdit.edit")} options={tags.map((t) => ({ value: t.id, label: t.name }))} value={value} onValueChange={setValue} max={20} />}
              {problem ? <Alert tone="danger">{problem}</Alert> : null}
              <div className="flex flex-wrap gap-3">
                <Button size="md" loading={save.isPending} onClick={() => void submit()}>
                  {say("dossiers.tagsEdit.save")}
                </Button>
                <CreateButton kind="tag" variant="ghost" tagsOf="applicant_file" />
              </div>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Root>
      ) : null}
    </section>
  );
}
