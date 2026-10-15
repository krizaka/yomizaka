import { UsersTable } from "@/components/admin/UsersTable";
import { listUsers } from "@/lib/accounts";

export default async function AdminUsers() {
  return <UsersTable users={await listUsers()} />;
}
