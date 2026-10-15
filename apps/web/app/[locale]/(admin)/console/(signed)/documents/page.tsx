import { DocumentsTable } from "@/components/admin/AdminTables";
import { allDocuments } from "@/lib/admin";

export default async function AdminDocuments() {
  return <DocumentsTable rows={await allDocuments()} />;
}
