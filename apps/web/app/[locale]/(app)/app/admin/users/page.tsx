import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UsersTable } from "@/components/console/UsersTable";
import { pageAdmin } from "@/lib/access";
import { listUsers } from "@/lib/accounts";
import { asLocale, getDictionary } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.users, robots: { index: false, follow: false } };
}

/** The accounts — three locks (session, ADMIN, an allowed address); a failed lock is a 404: the page does not exist. */
export default async function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  if (!(await pageAdmin())) notFound();
  const t = getDictionary(asLocale((await params).locale)).console.admin;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">{t.note}</p>
      <UsersTable users={await listUsers()} />
    </div>
  );
}
