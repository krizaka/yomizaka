import { analysis, closingNote, documentSummary, type StartAnalysis, storageDescriptor } from "@yomizaka/core";
import { z } from "zod";

import { limitsFromConfig, type PreflightLimits } from "./preflight";

/** What the apps give: `createApiClient` of `@krizaka/app-client` fits as is, on a phone and on the Mac. */
export interface ApiPort {
  call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
  url(path: string): string;
  authHeaders(): Promise<Record<string, string>>;
}

/** The two moves of the bearer session the API's answers start and end. */
export interface SessionPort {
  saveToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
}

export type Locale = "fr" | "en";

const accountAnswer = z.object({ account: z.object({ email: z.string(), locale: z.enum(["fr", "en"]) }), token: z.string() });
const appConfig = z.object({ config: z.object({ maxFileBytes: z.number(), allowedTypes: z.array(z.string()), features: z.object({ keepDocuments: z.boolean() }).passthrough() }) });
const uploaded = z.object({ document: documentSummary, duplicate: z.boolean() });
const started = z.object({ analysis, reused: z.boolean().optional() });
const analysisAnswer = z.object({ analysis, closingNote: closingNote.nullable() });
const documentAnswer = z.object({ document: documentSummary.extend({ analyses: z.array(analysis), storage: storageDescriptor.optional() }) });
const tag = z.object({ id: z.string(), name: z.string(), color: z.string() });
const libraries = z.object({
  libraries: z.array(z.object({ id: z.string(), name: z.string(), collections: z.array(z.object({ id: z.string(), name: z.string(), files: z.number(), folders: z.number(), tags: z.array(tag) })) })),
  tags: z.array(tag),
});

/**
 * Yomizaka's API as the apps use it. Every answer is parsed at the edge: a shape the server did not promise stops here,
 * never inside a screen.
 */
export function createYomizakaApi(port: ApiPort, session: SessionPort) {
  const get = <T extends z.ZodType>(schema: T, path: string): Promise<z.infer<T>> => port.call<unknown>(path).then((value) => schema.parse(value));
  return {
    /** The account signs in; its bearer token is kept by `session`. */
    async signIn(email: string, password: string) {
      const answer = accountAnswer.parse(await port.call("/api/auth/sign-in", { method: "POST", body: { email, password, client: "native" } }));
      await session.saveToken(answer.token);
      return answer.account;
    },
    async signOut(): Promise<void> {
      await port.call("/api/auth/sign-out", { method: "POST" }).catch(() => undefined);
      await session.clearToken();
    },
    /** The limits the web applies, read from the server so the app's pre-flight is the web's. */
    async fetchLimits(): Promise<PreflightLimits> {
      return limitsFromConfig((await get(appConfig, "/api/me/app")).config);
    },
    /** One file as multipart (field `file`): never kept by the server, the document is purged after its check. */
    async uploadDocument(form: FormData) {
      return uploaded.parse(await port.call("/api/documents", { method: "POST", body: form }));
    },
    listDocuments: () => get(z.object({ documents: z.array(documentSummary) }), "/api/documents").then((r) => r.documents),
    async startAnalysis(documentId: string, request: StartAnalysis) {
      return started.parse(await port.call(`/api/documents/${documentId}`, { method: "POST", body: request }));
    },
    fetchAnalysis: (documentId: string, analysisId: string, locale: Locale) => get(analysisAnswer, `/api/documents/${documentId}/analyses/${analysisId}?lang=${locale}`),
    fetchDocument: (documentId: string) => get(documentAnswer, `/api/documents/${documentId}`).then((r) => r.document),
    fetchLibraries: () => get(libraries, "/api/libraries"),
    fetchCollection: (collectionId: string, tags: readonly string[]) => get(z.object({ documents: z.array(documentSummary) }), `/api/collections/${collectionId}${tags.length ? `?tags=${tags.join(",")}` : ""}`),
    async placeDocument(documentId: string, collectionId: string | null): Promise<void> {
      await port.call(`/api/documents/${documentId}/placement`, { method: "PUT", body: { collectionId } });
    },
    async deleteDocument(documentId: string): Promise<void> {
      await port.call(`/api/documents/${documentId}`, { method: "DELETE" });
    },
    /** The signed report, as a PDF: its address and the person's headers, for the download. */
    async reportRequest(documentId: string, analysisId: string, locale: Locale) {
      return { url: port.url(`/api/documents/${documentId}/analyses/${analysisId}/report?format=pdf&lang=${locale}`), headers: await port.authHeaders() };
    },
  };
}

export type YomizakaApi = ReturnType<typeof createYomizakaApi>;
export type DocumentDetail = Awaited<ReturnType<YomizakaApi["fetchDocument"]>>;
