import { ApiError } from "@krizaka/app-client";
import { useMutation, useQueryClient } from "@krizaka/query";
import { availableChecks, DEFAULT_LIMITS, keys, type PreflightReason, preflight } from "@yomizaka/client";

import { yomizaka } from "./config";
import { localDocuments } from "./local-documents";
import { bytesOf, native } from "./native";
import { type Route } from "./route";

/** Why a file did not become a check: a refusal of the pre-flight, or the server's. */
export class Refused extends Error {
  constructor(readonly reason: PreflightReason | "paywall" | "unreadable" | "failed") {
    super(reason);
  }
}

const PAYWALL_STATUS = 402;
const CONFLICT_STATUS = 409;

/**
 * Check a document of the Mac: the file is read through the folder scope, the web's pre-flight applies, the bytes go up for
 * this one check (never kept), the first check the document can have starts, and the answer is where to look.
 */
export function useCheck(onStarted: (route: Route) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (path: string): Promise<Route | null> => {
      const document = await native.readDocument(path).catch(() => {
        throw new Refused("unreadable");
      });
      const limits = await yomizaka.fetchLimits().catch(() => DEFAULT_LIMITS);
      const verdict = preflight({ uri: path, name: document.name, mimeType: document.mime, size: document.size }, limits);
      if (!verdict.ok) throw new Refused(verdict.reason);
      const form = new FormData();
      form.append("file", new Blob([bytesOf(document.data)], { type: document.mime }), document.name);
      form.append("kind", "auto");
      const { document: uploaded } = await yomizaka.uploadDocument(form);
      localDocuments.remember(uploaded.id, path);
      const [first] = availableChecks(uploaded);
      if (!first) throw new Refused("failed");
      try {
        const { analysis } = await yomizaka.startAnalysis(uploaded.id, first);
        return { screen: "check", documentId: uploaded.id, analysisId: analysis.id };
      } catch (error) {
        // The same document is already being checked: its latest run is shown.
        if (error instanceof ApiError && error.status === CONFLICT_STATUS) {
          const detail = await yomizaka.fetchDocument(uploaded.id);
          const latest = detail.analyses[0];
          return latest ? { screen: "check", documentId: uploaded.id, analysisId: latest.id } : null;
        }
        throw new Refused(error instanceof ApiError && error.status === PAYWALL_STATUS ? "paywall" : "failed");
      }
    },
    onSuccess: async (route) => {
      await queryClient.invalidateQueries({ queryKey: keys.documents() });
      if (route) onStarted(route);
    },
  });
}
