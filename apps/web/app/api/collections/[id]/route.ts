import { containerHandlers } from "@/lib/organisation/handlers";

export const dynamic = "force-dynamic";

export const { PATCH, DELETE } = containerHandlers("collection");
