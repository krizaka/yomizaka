"use client";

import { Tabs } from "@krizaka/ui/tabs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Tabs whose state is the URL (`<base>/<tab>`): each tab is a link, the active one is read from the path (Krizaka UI's
 * `Tabs.Nav`), so back, forward, refresh and a shared link all work.
 */
export function RouteTabs({ base, label, items, children }: { base: string; label: string; items: readonly { value: string; label: string }[]; children: ReactNode }) {
  const current = usePathname() ?? base;
  return (
    <>
      <Tabs.Nav label={label} current={current}>
        {items.map((item) => (
          <Tabs.NavLink key={item.value} href={`${base}/${item.value}`} exact asChild>
            <Link href={`${base}/${item.value}`} scroll={false}>
              {item.label}
            </Link>
          </Tabs.NavLink>
        ))}
      </Tabs.Nav>
      <div className="pt-6">{children}</div>
    </>
  );
}
