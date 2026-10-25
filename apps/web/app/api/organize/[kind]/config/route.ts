import { workspaceAct } from "@/lib/workspace/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ kind: string }> };

/** The kind's configuration as the database holds it (the decision set, the system views, the tag rules) and its version: what the screens read their words and menus from. */
export const GET = (req: Request, { params }: Params) => workspaceAct(req, params, async ({ kind, workspace }) => ({ configuration: await workspace.config.get(kind) }));
