import { ConsoleProviders } from "@/components/console/ConsoleProviders";
import { MaintenanceNotice } from "@/components/console/MaintenanceNotice";
import { pageSession } from "@/lib/access";
import { asLocale, getDictionary } from "@/lib/i18n";
import { maintenance } from "@/lib/settings/guards";

/** What the signed-in space and its sign-in page share: the language slice and the query client — and the maintenance notice while the app is closed (an administrator still gets in). */
export default async function AppLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const { console: messages } = getDictionary(locale);
  const closed = await maintenance();
  if (closed.on && (await pageSession().catch(() => null))?.account.role !== "ADMIN") return <MaintenanceNotice title={messages.maintenance.title} message={closed.message[locale]} />;
  return (
    <ConsoleProviders locale={locale} messages={{ console: messages }}>
      {children}
    </ConsoleProviders>
  );
}
