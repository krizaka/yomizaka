"use client";

import { Tabs } from "@krizaka/ui/tabs";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Tabs whose state is the URL (`<base>/<tab>`): back, forward, refresh and a shared link all work. Until Krizaka UI's Tabs
 * route mode ships this pushes the route itself; it is the one place to switch over.
 */
export function RouteTabs({ value, base, label, items, children }: { value: string; base: string; label: string; items: readonly { value: string; label: string }[]; children: ReactNode }) {
  const router = useRouter();
  return (
    <Tabs.Root value={value} onValueChange={(v: string) => router.push(`${base}/${v}`, { scroll: false })}>
      <Tabs.List aria-label={label}>
        {items.map((item) => (
          <Tabs.Trigger key={item.value} value={item.value}>
            {item.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <div className="pt-6">{children}</div>
    </Tabs.Root>
  );
}
