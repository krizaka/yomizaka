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
  const chips = [...document.querySelectorAll('[data-testid="audience-picker"] a')].map((a) => Math.round(a.getBoundingClientRect().height));
  // A long token (an id, an address) that wraps character by character: a cell taller than two lines for text without a space.
  const wrapped = [...document.querySelectorAll("td, th, code, [role=cell]")]
    .filter((el) => {
      const text = (el.textContent || "").trim();
      if (text.length < 12 || /\s/.test(text) || el.children.length > 1) return false;
      const lh = Number.parseFloat(getComputedStyle(el).lineHeight) || Number.parseFloat(getComputedStyle(el).fontSize) * 1.4;
      const cs = getComputedStyle(el);
      const content = el.getBoundingClientRect().height - Number.parseFloat(cs.paddingTop) - Number.parseFloat(cs.paddingBottom);
      return content > lh * 2.5;
    })
    .slice(0, 2)
    .map((el) => (el.textContent || "").trim().slice(0, 24));
  const emptyHeadings = [...document.querySelectorAll("h1, h2, h3")].filter((h) => !(h.textContent || "").trim() && !h.querySelector("img, svg[aria-label]")).length;
  const unlabelledFiles = [...document.querySelectorAll("input[type=file]")].filter((i) => !(i.getAttribute("aria-label") || i.getAttribute("aria-labelledby") || i.title || i.labels?.length)).length;
  const segmentError = !!document.querySelector('[data-testid="segment-error"]');
  return { emptyHeadings, unlabelledFiles, wrapped, segmentError, h1: document.querySelectorAll("h1").length, scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, wide, unnamedButtons, unnamedSamples, headerAction, chips };
}

/**
 * The problems of one page × width × theme, in words: console errors, a horizontal overflow (or elements past the edge),
 * not exactly one h1 (when asked), unnamed buttons, the header's action off screen or unnamed (when the page has one).
 */
export function problemsOf(where, result, { errors = [], h1 = false, headerAction = false, fileLabels = false } = {}) {
  const problems = [];
  if (errors.length) problems.push(`${where}: console error — ${errors[0]}`);
  if (result.scrollWidth > result.clientWidth) problems.push(`${where}: scrollWidth ${result.scrollWidth} > ${result.clientWidth} (${result.wide.join(", ")})`);
  else if (result.wide.length) problems.push(`${where}: elements past the edge (${result.wide.join(", ")})`);
  if (result.wrapped?.length) problems.push(`${where}: a token wraps one character per line (${result.wrapped.join(", ")}) — truncate it`);
  if (result.emptyHeadings) problems.push(`${where}: ${result.emptyHeadings} empty heading(s)`);
  // Opt-in until `Dropzone` of @krizaka/ui names its hidden input (a prop of the package, not of this repository).
  if (fileLabels && result.unlabelledFiles) problems.push(`${where}: ${result.unlabelledFiles} file input(s) without a label`);
  if (result.segmentError) problems.push(`${where}: the page rendered its error state (segment-error), e.g. React #441`);
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
