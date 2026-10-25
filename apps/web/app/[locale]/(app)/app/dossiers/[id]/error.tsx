"use client";

import { SegmentError } from "@/components/console/SegmentStates";

/** When this page fails: the cause in place and « Réessayer »; the shell stays usable (P11). */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <SegmentError error={error} retry={retry} />;
}
