// @vitest-environment jsdom
import { KrizakaQueryProvider } from "@krizaka/query";
import { AppHeaderSearch } from "@krizaka/ui/app-header/search";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { ConsoleSearch } from "./ConsoleSearch";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace() {}, refresh() {} }),
  usePathname: () => "/fr/app",
  useSearchParams: () => new URLSearchParams(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const DOC = "11111111-1111-4111-8111-111111111111";
const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;

/** What the frame (`AppFrame`) does around the palette: the trigger and the shortcut, the open state. */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AppHeaderSearch label={fr.console.shell.palette.label} onOpen={() => setOpen(true)} />
      <ConsoleSearch open={open} onOpenChange={setOpen} />
    </>
  );
}

let root: Root | null = null;
const mount = async () => {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <I18nProvider locale="fr" messages={MESSAGES.fr as never}>
        <KrizakaQueryProvider>
          <Harness />
        </KrizakaQueryProvider>
      </I18nProvider>,
    );
  });
};
const press = (init: KeyboardEventInit) =>
  act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init })));

beforeAll(() => {
  // jsdom lacks what cmdk and Radix measure.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  Element.prototype.scrollIntoView ??= () => {};
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as never;
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  push.mockClear();
});

describe("⌘K opens the palette (B2, P14)", () => {
  it("is closed until ⌘K (or Ctrl K) is pressed, then opens a dialog named « Rechercher dans vos documents »", async () => {
    await mount();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await press({ key: "k", metaKey: true });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(document.body.textContent).toContain(fr.console.shell.palette.type);
  });

  it("Ctrl K opens it too, and a plain k does not", async () => {
    await mount();
    await press({ key: "k" });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await press({ key: "k", ctrlKey: true });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("the trigger button opens it as well (a phone has no keyboard)", async () => {
    await mount();
    const trigger = document.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']")!;
    expect(trigger.textContent).toContain(fr.console.shell.palette.label);
    await act(async () => trigger.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("asks the server once two letters are typed, lists the hits and opens the document of the one chosen", async () => {
    const fetched: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        fetched.push(String(input));
        return new Response(
          JSON.stringify({
            hits: [
              {
                documentId: DOC,
                title: "Bail Rosemont",
                kind: "lease",
                source: "title",
                passage: "<b>Bail</b> du 1er juillet",
                rank: 1,
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }),
    );
    await mount();
    await press({ key: "k", metaKey: true });
    const input = document.querySelector<HTMLInputElement>("input")!;
    const type = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    await type("b");
    expect(fetched).toHaveLength(0);
    await type("ba");
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(fetched.some((u) => u.includes("/api/search") && u.includes("q=ba"))).toBe(true);
    expect(document.body.textContent).toContain("Bail Rosemont");
    expect(document.body.textContent).toContain(fr.console.shell.palette.all);
    const item = document.querySelector<HTMLElement>("[cmdk-item]")!;
    await act(async () => item.click());
    expect(push).toHaveBeenCalledWith(`/fr/app/documents/${DOC}`);
  });
});
