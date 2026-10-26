import { Mascot } from "@krizaka/ui/mascots";

/** The app is closed for consumers: the message an administrator wrote, in the visitor's language. */
export function MaintenanceNotice({ title, message }: Readonly<{ title: string; message: string }>) {
  return (
    <main id="content" className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center" data-testid="maintenance">
      <Mascot bird="owl" mood="empty" size={144} />
      <h1 className="m-0 font-display text-2xl font-bold text-fg">{title}</h1>
      <p className="m-0 text-fg-secondary">{message}</p>
    </main>
  );
}
