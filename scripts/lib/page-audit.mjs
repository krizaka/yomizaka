// What a rendered page is measured on, in a real browser (Playwright `page.evaluate(auditPage)`), and what counts as a problem.
// Shared by the responsive guard of the public pages (check-overflow.mjs) and the signed-in pages' check (check-app-pages.mjs).

/** Runs in the page: the h1 count, the horizontal overflow and who pokes out, the unnamed buttons, the header's action, the audience chips. */
export function auditPage() {
  const doc = document.documentElement;
  // An element that pokes out only matters when nothing clips it: decorative layers (aria-hidden) and anything inside a
  // clipping or scrolling ancestor (overflow hidden / clip / auto / scroll) are meant to extend.
  const clipped = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.getAttribute("aria-hidden") === "true") return true;
      if (n !== el && ["hidden", "clip", "auto", "scroll"].includes(getComputedStyle(n).overflowX)) return true;
    }
    return false;
  };
  const wide = [...document.querySelectorAll("body *")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > doc.clientWidth + 1 || r.left < -1) && !clipped(el);
    })
    .slice(0, 3)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`);
  // A button's accessible name: its text, aria-label, aria-labelledby, title — or a <label for> pointing at it (a checkbox, a switch).
  const named = (b) => !!((b.textContent || "").trim() || b.getAttribute("aria-label") || b.getAttribute("aria-labelledby") || b.title || (b.id && document.querySelector(`label[for="${CSS.escape(b.id)}"]`)));
  const unnamed = [...document.querySelectorAll("button")].filter((b) => !named(b));
  const unnamedButtons = unnamed.length;
  const unnamedSamples = unnamed.slice(0, 2).map((b) => b.outerHTML.slice(0, 160).replace(/\s+/g, " "));
  const action = document.querySelector('[data-testid="header-check"]');
  const box = action?.getBoundingClientRect();
  const headerAction = action
    ? { visible: !!box && box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= doc.clientWidth + 1 && box.top >= 0, named: !!((action.getAttribute("aria-label") || action.textContent || "").trim()) }
    : null;
  // Layout: what the horizontal-overflow check above cannot see (yomizaka#435).
  // - `overflowing`: a panel's content that runs out of the panel (a card taller than its panel, over the next section);
  // - `overlaps`: two sections that are not nested and cover each other;
  // - `cutColumns`: a section or a column cut by a clipping ancestor (overflow hidden / clip), which hides part of its content.
  // Decorative layers (aria-hidden), fixed elements and anything inside a scroller (overflow auto / scroll) are left out.
  const panels = [...document.querySelectorAll("[data-panel], main section, main [role=region]")].filter((el) => !el.closest('[aria-hidden="true"]'));
  const nameOf = (el) => `${el.tagName.toLowerCase()}${el.getAttribute("data-testid") ? `[${el.getAttribute("data-testid")}]` : ""}.${String(el.className).split(" ").filter(Boolean).slice(0, 2).join(".")}`;
  const scrolls = (el) => ["auto", "scroll"].includes(getComputedStyle(el).overflowY) || ["auto", "scroll"].includes(getComputedStyle(el).overflowX);
  const overflowing = [];
  const spill = [];
  for (const panel of panels) {
    if (scrolls(panel) || ["hidden", "clip"].includes(getComputedStyle(panel).overflowY)) continue;
    const box = panel.getBoundingClientRect();
    const out = [...panel.querySelectorAll("*")].find((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).position === "fixed" || el.closest('[aria-hidden="true"]') || el.closest("[data-radix-popper-content-wrapper]")) return false;
      // What a folded `<details>` holds is not drawn, though the browser still gives it a box.
      const folded = el.closest("details:not([open])");
      if (folded && !el.closest("summary")) return false;
      // A scroller keeps what runs out of it; a visually hidden wrapper (`sr-only`: a 1 px clipped box, the text version of a chart) shows nothing.
      for (let n = el.parentElement; n && n !== panel; n = n.parentElement) {
        if (scrolls(n)) return false;
        const nb = n.getBoundingClientRect();
        if ((nb.width <= 2 || nb.height <= 2) && getComputedStyle(n).overflowY !== "visible") return false;
      }
      return r.bottom > box.bottom + 1.5 || r.right > box.right + 1.5;
    });
    if (out) {
      overflowing.push(`${nameOf(out)} out of ${nameOf(panel)}`);
      spill.push(out);
    }
  }
  const overlaps = [];
  const meets = (ra, rb) => Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 2 && Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > 2;
  // What ran out of its panel may land on another section: that is the card covering « Dernières vérifications ».
  for (const el of spill) {
    for (const other of panels) if (!other.contains(el) && !el.contains(other)) if (meets(el.getBoundingClientRect(), other.getBoundingClientRect())) overlaps.push(`${nameOf(el)} over ${nameOf(other)}`);
  }
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const [a, b] = [panels[i], panels[j]];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      if (meets(ra, rb)) overlaps.push(`${nameOf(a)} over ${nameOf(b)}`);
    }
  }
  const cutColumns = [];
  for (const el of document.querySelectorAll("main section, main aside, main [data-testid], [data-panel]")) {
    if (el.closest('[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (["auto", "scroll"].includes(style.overflowX)) break;
      if (["hidden", "clip"].includes(style.overflowX)) {
        const c = n.getBoundingClientRect();
        if (r.right > c.right + 2 || r.left < c.left - 2) cutColumns.push(`${nameOf(el)} cut by ${nameOf(n)}`);
        break;
      }
    }
  }
  const chips = [...document.querySelectorAll('[data-testid="audience-picker"] a')].map((a) => Math.round(a.getBoundingClientRect().height));
  return { h1: document.querySelectorAll("h1").length, scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, wide, unnamedButtons, unnamedSamples, headerAction, chips, overflowing: overflowing.slice(0, 3), overlaps: overlaps.slice(0, 3), cutColumns: [...new Set(cutColumns)].slice(0, 3) };
}

/**
 * The problems of one page × width × theme, in words: console errors, a horizontal overflow (or elements past the edge),
 * not exactly one h1 (when asked), unnamed buttons, the header's action off screen or unnamed (when the page has one).
 */
export function problemsOf(where, result, { errors = [], h1 = false, headerAction = false } = {}) {
  const problems = [];
  if (errors.length) problems.push(`${where}: console error — ${errors[0]}`);
  if (result.scrollWidth > result.clientWidth) problems.push(`${where}: scrollWidth ${result.scrollWidth} > ${result.clientWidth} (${result.wide.join(", ")})`);
  else if (result.wide.length) problems.push(`${where}: elements past the edge (${result.wide.join(", ")})`);
  for (const [list, words] of [[result.overflowing, "overflows its panel"], [result.overlaps, "covers a neighbouring section"], [result.cutColumns, "is cut off"]]) {
    if (list?.length) problems.push(`${where}: ${words} (${list.join(", ")})`);
  }
  if (h1 && result.h1 !== 1) problems.push(`${where}: ${result.h1} h1 (expected exactly one)`);
  if (h1 && result.unnamedButtons > 0) problems.push(`${where}: ${result.unnamedButtons} unnamed button(s) ${(result.unnamedSamples ?? []).join(" | ")}`.trimEnd());
  if (headerAction) {
    if (!result.headerAction) problems.push(`${where}: no header action`);
    else if (!result.headerAction.visible) problems.push(`${where}: the header's action is off screen`);
    else if (!result.headerAction.named) problems.push(`${where}: the header's action has no accessible name`);
  }
  if ((result.chips ?? []).some((h) => h < 44)) problems.push(`${where}: a chip is ${Math.min(...result.chips)} px tall (< 44)`);
  return problems;
}
