"use client";

import { cn } from "@krizaka/ui/cn";
import { DeviceFrame } from "@krizaka/ui/step-showcase";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const q = window.matchMedia(REDUCED);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};

export interface TakeChapterWords {
  id: string;
  title: string;
  text: string;
  at: number;
}

/**
 * « Du fichier au constat »: the real recorded take in a phone frame — phone first, so it is as sharp on a phone as on a
 * desktop, where it sits beside its four chapters over a blurred copy of its own poster. It plays muted and loops while it
 * is on screen (never under `prefers-reduced-motion`: the poster stays), and the chapter being shown is lit.
 */
export function AppTake({ label, address, poster, webm, mp4, chapters, playLabel, pauseLabel }: { label: string; address: string; poster: string; webm: string; mp4: string; chapters: readonly TakeChapterWords[]; playLabel: string; pauseLabel: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const root = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const still = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);

  useEffect(() => {
    const el = video.current;
    if (!el || still) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      if (entry.isIntersecting) void el.play().catch(() => undefined);
      else el.pause();
    }, { threshold: 0.35 });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, [still]);

  const onTime = () => {
    const t = video.current?.currentTime ?? 0;
    let i = 0;
    chapters.forEach((c, k) => {
      if (t >= c.at - 0.05) i = k;
    });
    setCurrent(i);
  };
  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  };
  const jump = (i: number) => {
    const el = video.current;
    if (!el) return;
    el.currentTime = chapters[i]!.at;
    void el.play().catch(() => undefined);
  };

  return (
    <section ref={root} aria-label={label} className="relative isolate overflow-hidden rounded-3xl border border-border-default bg-surface-1 p-5 sm:p-8" data-testid="app-take">
      {/* A blurred copy of the take's own poster, for depth behind the phone — decorative. */}
      <Image aria-hidden alt="" src={poster} fill unoptimized sizes="100vw" className="pointer-events-none -z-10 scale-125 object-cover opacity-30 blur-3xl" />
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_21rem] md:gap-14">
        <ol className="order-2 m-0 flex max-w-xl list-none flex-col gap-2 p-0 md:order-1 md:justify-self-end" aria-label={label}>
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button type="button" onClick={() => jump(i)} aria-current={i === current ? "step" : undefined} className={cn("flex min-h-12 w-full items-start gap-3 rounded-xl border px-4 py-3 text-start transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring", i === current ? "border-accent bg-accent-soft" : "border-border-default bg-surface-1/70 hover:border-border-strong")}>
                <span className="mt-0.5 font-mono text-xs text-fg-accent">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-base font-semibold text-fg">{c.title}</span>
                  <span className="max-w-[60ch] text-sm leading-snug text-fg-secondary">{c.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="order-1 mx-auto flex w-full max-w-[19rem] flex-col items-center gap-3 md:order-2 md:max-w-none">
          <DeviceFrame kind="phone" title={address}>
            <video ref={video} className="absolute inset-0 h-full w-full object-cover" poster={poster} muted loop playsInline preload="metadata" onTimeUpdate={onTime} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} aria-label={label}>
              <source src={webm} type="video/webm" />
              <source src={mp4} type="video/mp4" />
            </video>
          </DeviceFrame>
          {still ? null : (
            <button type="button" onClick={toggle} className="min-h-11 rounded-full border border-border-default bg-surface-1 px-4 text-sm font-semibold text-fg-secondary hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
              {playing ? pauseLabel : playLabel}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
