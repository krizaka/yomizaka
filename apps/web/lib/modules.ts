import { apiKeysSchema } from "@krizaka/api-keys";
import { accountsSchema } from "@krizaka/auth";
import type { ComposedModule } from "@krizaka/db";
import { workspaceSchema } from "@krizaka/organize";
import { pricesSchema, settingsSchema } from "@krizaka/settings";
import { webhooksSchema } from "@krizaka/webhooks";

import { WORKSPACE } from "./workspace/decl";

/**
 * The Krizaka modules whose tables this database holds, with the product table each one points at. Their SQL ran before
 * `@krizaka/db` (0016, 0021, 0023, 0029, 0033, 0034): migration 0036 adopts them (markers only, no DDL), and `assertModules`
 * refuses to start on a database that lacks a version the code needs (`instrumentation.ts`). `lib/modules.test.ts` holds the
 * migration to this list.
 */
export const MODULES: readonly ComposedModule[] = [
  { schema: settingsSchema, context: { tables: {} } },
  { schema: pricesSchema, context: { tables: {} } },
  { schema: accountsSchema(), context: { tables: { accounts: "accounts" } } },
  { schema: apiKeysSchema, context: { tables: { owner: "accounts" } } },
  { schema: webhooksSchema, context: { tables: { owner: "accounts" } } },
  { schema: workspaceSchema(WORKSPACE), context: { tables: {} } },
];
