import { notFound, redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { pageAdmin, pageSession } from "@/lib/access";
import { asLocale } from "@/lib/i18n";

/** Three locks: a session, the ADMIN role, an address of AUTH_ALLOWED_IPS. No session → sign-in; the rest → 404. */
export default async function SignedAdmin({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = await pageSession();
  if (!session) redirect(`/${locale}/sign-in`);
  if (!(await pageAdmin())) notFound();
  return (
    <AdminShell locale={locale} email={session.account.email}>
      {children}
    </AdminShell>
  );
}
