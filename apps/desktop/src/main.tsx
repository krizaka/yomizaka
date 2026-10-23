import "./styles.css";

import { KrizakaQueryProvider, useQueryClient } from "@krizaka/query";
import { ThemeProvider } from "@krizaka/ui/theme";
import { type ReactNode, StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { session } from "./lib/config";

/** One account's data never shows to the next: a session that starts or ends (sign-out, sign-in, a 401) empties the cache. */
function SessionBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      session.onChange(() => {
        void queryClient.cancelQueries();
        queryClient.clear();
      }),
    [queryClient],
  );
  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultMode="system">
      <KrizakaQueryProvider throwOnError={false}>
        <SessionBoundary>
          <App />
        </SessionBoundary>
      </KrizakaQueryProvider>
    </ThemeProvider>
  </StrictMode>,
);
