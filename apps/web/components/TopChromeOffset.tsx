"use client";

import { useEffect } from "react";

/** How far down the fixed bar must stand so that it clears the top chrome still in view: the lowest bottom edge, never negative (pure). */
export const chromeOffset = (bottoms: readonly number[]): number => Math.max(0, Math.round(Math.max(0, ...bottoms)));

/**
 * Tells the fixed bar how much top chrome (`[data-top-chrome]`, the development-version notice) is still in view: `--kz-top-chrome`,
 * in pixels, on the root. The notice stands in the flow above the page and scrolls away; the bar is fixed, so it follows the notice's
 * bottom edge down to 0 instead of covering it (yomizaka#449). Nothing when there is no such block (production).
 */
export function TopChromeOffset() {
  useEffect(() => {
    const root = document.documentElement;
    const blocks = [...document.querySelectorAll("[data-top-chrome]")];
    if (blocks.length === 0) return;
    const apply = () => root.style.setProperty("--kz-top-chrome", `${chromeOffset(blocks.map((b) => b.getBoundingClientRect().bottom))}px`);
    apply();
    const resize = new ResizeObserver(apply);
    for (const block of blocks) resize.observe(block);
    window.addEventListener("scroll", apply, { passive: true });
    return () => {
      resize.disconnect();
      window.removeEventListener("scroll", apply);
      root.style.removeProperty("--kz-top-chrome");
    };
  }, []);
  return null;
}
