import "./styles.css";

import { KrizakaQueryProvider } from "@krizaka/query";
import { ThemeProvider } from "@krizaka/ui/theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultMode="system">
      <KrizakaQueryProvider throwOnError={false}>
        <App />
      </KrizakaQueryProvider>
    </ThemeProvider>
  </StrictMode>,
);
