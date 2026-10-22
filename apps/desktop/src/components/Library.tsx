import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { useEffect, useState } from "react";

import { useI18n } from "../i18n";
import { type Listing, native, onDropped } from "../lib/native";
import { type Route } from "../lib/route";
import { Refused, useCheck } from "../lib/use-check";

const FOLDERS_KEY = ["yomizaka-desktop", "folders"] as const;
const folderKey = (path: string) => ["yomizaka-desktop", "folder", path] as const;

const sizeOf = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

/** The library: the folders the person granted, a folder's documents, and a drop zone for a file straight from Finder. */
export function Library({ folder, go }: { folder: string | null; go: (route: Route) => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const folders = useQuery({ queryKey: FOLDERS_KEY, queryFn: native.folders });
  const listing = useQuery({ queryKey: folderKey(folder ?? ""), queryFn: (): Promise<Listing> => native.listFolder(folder as string), enabled: folder !== null });
  const check = useCheck(go);

  const add = useMutation({
    mutationFn: native.grantFolder,
    onSuccess: async (granted) => {
      await queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
      if (granted) go({ screen: "library", folder: granted });
    },
  });
  const revoke = useMutation({
    mutationFn: native.revokeFolder,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
      go({ screen: "library", folder: null });
    },
  });

  // A file dropped on the window from Finder: the native side has allowed that one file for this session.
  const [dragging, setDragging] = useState(false);
  const { mutate: start } = check;
  useEffect(() => {
    const off = onDropped((paths) => {
      setDragging(false);
      if (paths[0]) start(paths[0]);
    });
    return () => void off.then((stop) => stop());
  }, [start]);

  const refusal = check.error instanceof Refused ? check.error.reason : check.isError ? "failed" : null;

  return (
    <div className="flex h-full min-h-0" onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)}>
      <aside aria-label={t("library.title")} className="flex w-64 shrink-0 flex-col gap-3 border-r border-border-subtle p-4">
        <Button onClick={() => add.mutate()} loading={add.isPending}>
          {t("library.addFolder")}
        </Button>
        {add.isError ? <Alert tone="danger">{t("library.folderDenied")}</Alert> : null}
        <ul className="flex flex-col gap-1">
          {(folders.data ?? []).map((path) => (
            <li key={path}>
              <Button variant={path === folder ? "secondary" : "ghost"} className="w-full justify-start truncate" onClick={() => go({ screen: "library", folder: path })}>
                {path.split("/").filter(Boolean).pop()}
              </Button>
            </li>
          ))}
        </ul>
        <Badge tone="accent">{t("library.onMac")}</Badge>
      </aside>
      <section className={`flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-6 ${dragging ? "ym-dropping" : ""}`}>
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{folder ? folder.split("/").filter(Boolean).pop() : t("library.title")}</h1>
          <p className="text-fg-secondary">{dragging ? t("library.drop") : folder ? folder : t("library.lead")}</p>
        </header>
        {refusal ? <Alert tone="danger">{refusalText(refusal, t)}</Alert> : null}
        {check.isPending ? <p className="text-fg-secondary">{t("check.preparing")}</p> : null}
        {folder === null ? <p className="text-fg-secondary">{(folders.data ?? []).length ? t("library.dropHint") : t("library.emptyFolders")}</p> : null}
        {folder !== null && listing.data && listing.data.entries.length === 0 ? <p className="text-fg-secondary">{t("library.emptyFolder")}</p> : null}
        <ul className="flex flex-col divide-y divide-border-subtle">
          {(listing.data?.entries ?? []).map((entry) => (
            <li key={entry.path} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              <span className="text-sm text-fg-muted">{entry.isDir ? "" : sizeOf(entry.size)}</span>
              {entry.isDir ? (
                <Button size="sm" variant="ghost" onClick={() => go({ screen: "library", folder: entry.path })}>
                  {entry.name}
                </Button>
              ) : (
                <Button size="sm" variant="primary" disabled={check.isPending} onClick={() => check.mutate(entry.path)}>
                  {t("library.check")}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {folder !== null && (folders.data ?? []).includes(folder) ? (
          <div>
            <Button variant="ghost" size="sm" onClick={() => revoke.mutate(folder)}>
              {t("library.revoke")}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function refusalText(reason: string, t: ReturnType<typeof useI18n>["t"]): string {
  switch (reason) {
    case "paywall":
      return t("check.paywall");
    case "unreadable":
      return t("check.readFailed");
    case "failed":
      return t("check.startFailed");
    case "tooLarge":
      return t("preflight.tooLarge", { megabytes: 10 });
    default:
      return t(`preflight.${reason as "empty" | "unsupportedType"}`);
  }
}
