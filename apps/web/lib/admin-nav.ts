/**
 * The administration's navigation: seven pages in three groups (the Dev preview bar asks for about five top-level
 * sections — `admin.ux-review`). One list for the shell and its test; the words are `adminConsole.shell.*`.
 */
export type AdminPage = { key: "overview" | "users" | "documents" | "flows" | "runs" | "config" | "storage" | "operations" | "incidents" | "audit"; path: string };
export type AdminGroup = { key: "people" | "engine" | "app" | "operations"; pages: AdminPage[] };

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    key: "people",
    pages: [
      { key: "overview", path: "" },
      { key: "users", path: "/users" },
      { key: "documents", path: "/documents" },
    ],
  },
  {
    key: "engine",
    pages: [
      { key: "flows", path: "/flows" },
      { key: "runs", path: "/runs" },
    ],
  },
  {
    key: "app",
    pages: [
      { key: "config", path: "/config" },
      { key: "storage", path: "/storage" },
    ],
  },
  {
    key: "operations",
    pages: [
      { key: "operations", path: "/operations" },
      { key: "incidents", path: "/incidents" },
      { key: "audit", path: "/audit" },
    ],
  },
];

export const ADMIN_PAGES: AdminPage[] = ADMIN_GROUPS.flatMap((g) => g.pages);
