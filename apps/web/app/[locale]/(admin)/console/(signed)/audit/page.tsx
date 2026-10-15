import { AuditTable } from "@/components/admin/AdminTables";
import { auditLog } from "@/lib/admin";

export default async function AdminAudit() {
  return <AuditTable entries={await auditLog()} />;
}
