import { FlowsTable } from "@/components/admin/FlowsTable";
import { listAdminFlows } from "@/lib/flows";

export const dynamic = "force-dynamic";

/** The flows of the product, administered here (ADR-0003). */
export default async function AdminFlows() {
  return <FlowsTable flows={await listAdminFlows()} />;
}
