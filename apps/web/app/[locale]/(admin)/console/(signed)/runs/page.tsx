import { RunsTable } from "@/components/admin/AdminTables";
import { allRuns } from "@/lib/admin";

export default async function AdminRuns() {
  return <RunsTable rows={await allRuns()} />;
}
