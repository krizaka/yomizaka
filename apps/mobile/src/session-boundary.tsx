import type { SessionStore } from "@krizaka/app-client";
import { useQueryClient } from "@krizaka/query";
import { bindNativeLifecycle } from "@krizaka/query/native";
import * as React from "react";
import { AppState } from "react-native";

/**
 * One account's data never shows to the next: when a session starts or ends (a sign-out, a sign-in, a 401), the queries in
 * flight are cancelled, the cache is emptied, and the screens below are mounted again — a screen already on view keeps the
 * query it subscribed to, emptied cache or not, so a new mount is what makes it read afresh (and a failed read then shows
 * nothing of the previous account). Query's focus follows the app state, so the screens refresh when the app comes back to
 * the foreground.
 */
export function SessionBoundary({ session, children }: Readonly<{ session: Pick<SessionStore, "onChange">; children: React.ReactNode }>) {
  const queryClient = useQueryClient();
  const [generation, setGeneration] = React.useState(0);
  React.useEffect(
    () =>
      session.onChange(() => {
        void queryClient.cancelQueries();
        queryClient.clear();
        setGeneration((previous) => previous + 1);
      }),
    [queryClient, session],
  );
  React.useEffect(() => bindNativeLifecycle({ appState: AppState }), []);
  return <React.Fragment key={generation}>{children}</React.Fragment>;
}
