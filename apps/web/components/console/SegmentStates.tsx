"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Skeleton, SkeletonText } from "@krizaka/ui/skeleton";
import { useEffect } from "react";

import { useSay } from "@/lib/i18n-client";

/**
 * The states of a page of the app (design § 3.5, P11): while it loads, a skeleton of the page's own shape — never a centred
 * spinner —, shown only once the wait passes 300 ms (`ym-wait`, globals.css); when it fails, an Alert in place with the way
 * back, and the shell (rail, bar) stays usable around it.
 */
export const SEGMENT_SHAPES = ["home", "list", "detail", "check", "settings", "search", "panel"] as const;
export type SegmentShape = (typeof SEGMENT_SHAPES)[number];

/** The page's header: its title and its lead line. */
function Header() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 w-2/5 max-w-xs" />
      <Skeleton className="w-3/5 max-w-md" />
    </div>
  );
}

/** A list's rows: a title and one line of facts each. */
function Rows({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-default" data-skeleton="rows">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="w-1/2" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function Body({ shape }: { shape: SegmentShape }) {
  switch (shape) {
    case "home":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-3" data-skeleton="doors">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} shape="rect" className="h-20" />
            ))}
          </div>
          <Skeleton shape="rect" className="h-32" data-skeleton="drop" />
          <Rows count={4} />
        </>
      );
    case "list":
      return (
        <>
          <div className="flex gap-2" data-skeleton="filters">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-24" />
            ))}
          </div>
          <Rows />
        </>
      );
    case "detail":
      return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <Skeleton shape="rect" className="h-20" data-skeleton="verdict" />
            <Rows count={4} />
          </div>
          <div className="flex flex-col gap-3" data-skeleton="aside">
            <Skeleton shape="rect" className="h-10" />
            <SkeletonText lines={4} />
          </div>
        </div>
      );
    case "check":
      return (
        <>
          <Skeleton className="w-2/3" data-skeleton="defaults" />
          <Skeleton shape="rect" className="h-48" data-skeleton="drop" />
        </>
      );
    case "settings":
      return (
        <div className="flex flex-col gap-4" data-skeleton="sections">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-border-default p-4">
              <Skeleton className="h-4 w-1/4" />
              <SkeletonText lines={2} />
            </div>
          ))}
        </div>
      );
    case "search":
      return (
        <>
          <Skeleton shape="rect" className="h-11" data-skeleton="field" />
          <Rows count={4} />
        </>
      );
    case "panel":
      return <Skeleton shape="rect" className="h-64" data-skeleton="panel" />;
  }
}

/** A page of the app on its way: its shape in skeletons, announced once (`role="status"`, `aria-busy`). */
export function SegmentLoading({ shape }: { shape: SegmentShape }) {
  const { say } = useSay();
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="ym-wait flex min-w-0 flex-col gap-6" data-shape={shape} data-testid="segment-loading">
      <span className="sr-only">{say("states.loading")}</span>
      <Header />
      <Body shape={shape} />
    </div>
  );
}

/** A page of the app that failed: the cause in words and « Réessayer » (Next's `retry` re-fetches the segment). The raw error stays in the logs. */
export function SegmentError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { say } = useSay();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="segment-error">
      <Alert
        tone="danger"
        title={say("states.error.title")}
        action={
          <Button variant="secondary" size="sm" onClick={() => retry()}>
            {say("states.error.retry")}
          </Button>
        }
      >
        {say("states.error.text")}
      </Alert>
    </div>
  );
}
