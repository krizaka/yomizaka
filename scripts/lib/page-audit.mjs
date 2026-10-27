// What a rendered page is measured on, in a real browser (Playwright `page.evaluate(auditPage)`), and what counts as a problem.
// Shared by the responsive guard of the public pages (check-overflow.mjs) and the signed-in pages' check (check-app-pages.mjs).

// The probes below run in the page, so each uses only the browser's globals and the other probes (all of them are serialised together
// into `auditPage`). They are small on purpose: one measure each, proven on its own fixture (check-page-audit.mjs).

const ARIA_HIDDEN = '[aria-hidden="true"]';
const className = (el, n) => String(el.className).split(" ").filter(Boolean).slice(0, n).join(".");
const nameOf = (el) => {
  const id = el.dataset?.testid;
  return el.tagName.toLowerCase() + (id ? "[" + id + "]" : "") + "." + className(el, 2);
};
const scrolls = (el) => ["auto", "scroll"].includes(getComputedStyle(el).overflowY) || ["auto", "scroll"].includes(getComputedStyle(el).overflowX);
const meets = (ra, rb) => Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 2 && Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > 2;
const apart = (a, b) => !a.contains(b) && !b.contains(a);

/** An element that pokes out only matters when nothing clips it: decorative layers (aria-hidden) and anything inside a clipping or scrolling ancestor are meant to extend. */
function clipped(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.getAttribute("aria-hidden") === "true") return true;
    if (n !== el && ["hidden", "clip", "auto", "scroll"].includes(getComputedStyle(n).overflowX)) return true;
  }
  return false;
}

function wideOf(doc) {
  return [...document.querySelectorAll("body *")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > doc.clientWidth + 1 || r.left < -1) && !clipped(el);
    })
    .slice(0, 3)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`);
}

/** A button's accessible name: its text, aria-label, aria-labelledby, title — or a <label for> pointing at it (a checkbox, a switch). */
function named(b) {
  const labelled = !!b.id && !!document.querySelector(`label[for="${CSS.escape(b.id)}"]`);
  return !!((b.textContent || "").trim() || b.getAttribute("aria-label") || b.getAttribute("aria-labelledby") || b.title || labelled);
}

function unnamedOf() {
  const unnamed = [...document.querySelectorAll("button")].filter((b) => !named(b));
  return { unnamedButtons: unnamed.length, unnamedSamples: unnamed.slice(0, 2).map((b) => b.outerHTML.slice(0, 160).replace(/\s+/g, " ")) };
}

function headerActionOf(doc) {
  const action = document.querySelector('[data-testid="header-check"]');
  if (!action) return null;
  const box = action.getBoundingClientRect();
  const visible = box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= doc.clientWidth + 1 && box.top >= 0;
  return { visible, named: !!(action.getAttribute("aria-label") || action.textContent || "").trim() };
}

/** What a folded `<details>` holds is not drawn, though the browser still gives it a box (its summary is). */
function folded(el) {
  return !!el.closest("details:not([open])") && !el.closest("summary");
}

/** Whether an ancestor between the element and the panel keeps what runs out of it: a scroller, or a visually hidden wrapper (`sr-only`: a 1 px clipped box, the text version of a chart). */
function keptBetween(el, panel) {
  for (let n = el.parentElement; n && n !== panel; n = n.parentElement) {
    if (scrolls(n)) return true;
    const nb = n.getBoundingClientRect();
    if ((nb.width <= 2 || nb.height <= 2) && getComputedStyle(n).overflowY !== "visible") return true;
  }
  return false;
}

function notDrawn(el, r) {
  return r.width === 0 || r.height === 0 || getComputedStyle(el).position === "fixed" || !!el.closest(ARIA_HIDDEN) || !!el.closest("[data-radix-popper-content-wrapper]") || folded(el);
}

function runsOut(el, panel, box) {
  const r = el.getBoundingClientRect();
  if (notDrawn(el, r) || keptBetween(el, panel)) return false;
  return r.bottom > box.bottom + 1.5 || r.right > box.right + 1.5;
}

/** `overflowing`: a panel's content that runs out of the panel (a card taller than its panel, over the next section). `spill` holds those elements. */
function spillOf(panels) {
  const overflowing = [];
  const spill = [];
  for (const panel of panels) {
    if (scrolls(panel) || ["hidden", "clip"].includes(getComputedStyle(panel).overflowY)) continue;
    const box = panel.getBoundingClientRect();
    const out = [...panel.querySelectorAll("*")].find((el) => runsOut(el, panel, box));
    if (!out) continue;
    overflowing.push(`${nameOf(out)} out of ${nameOf(panel)}`);
    spill.push(out);
  }
  return { overflowing, spill };
}

/** `overlaps`: two sections that are not nested and cover each other, or what ran out of its panel and lands on another section (the card covering « Dernières vérifications »). */
function overlapsOf(panels, spill) {
  const overlaps = [];
  for (const el of spill) {
    for (const other of panels) if (apart(el, other) && meets(el.getBoundingClientRect(), other.getBoundingClientRect())) overlaps.push(`${nameOf(el)} over ${nameOf(other)}`);
  }
  panels.forEach((a, i) => {
    for (const b of panels.slice(i + 1)) if (apart(a, b) && meets(a.getBoundingClientRect(), b.getBoundingClientRect())) overlaps.push(`${nameOf(a)} over ${nameOf(b)}`);
  });
  return overlaps;
}

/** The clipping ancestor that cuts an element sideways (overflow hidden / clip), or null; a scroller stops the search (it keeps what runs out of it). */
function cutBy(el, r) {
  for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
    const style = getComputedStyle(n);
    if (["auto", "scroll"].includes(style.overflowX)) return null;
    if (!["hidden", "clip"].includes(style.overflowX)) continue;
    const c = n.getBoundingClientRect();
    return r.right > c.right + 2 || r.left < c.left - 2 ? n : null;
  }
  return null;
}

/** `cutColumns`: a section or a column cut by a clipping ancestor, which hides part of its content. */
function cutColumnsOf() {
  const cut = [];
  for (const el of document.querySelectorAll("main section, main aside, main [data-testid], [data-panel]")) {
    const r = el.getBoundingClientRect();
    if (el.closest(ARIA_HIDDEN) || r.width === 0 || r.height === 0) continue;
    const by = cutBy(el, r);
    if (by) cut.push(`${nameOf(el)} cut by ${nameOf(by)}`);
  }
  return [...new Set(cut)].slice(0, 3);
}

/** A long token (an id, an address) that wraps character by character: a cell taller than two lines for text without a space. */
function tooTall(el) {
  const text = (el.textContent || "").trim();
  if (text.length < 12 || /\s/.test(text) || el.children.length > 1) return false;
  const cs = getComputedStyle(el);
  const lh = Number.parseFloat(cs.lineHeight) || Number.parseFloat(cs.fontSize) * 1.4;
  const content = el.getBoundingClientRect().height - Number.parseFloat(cs.paddingTop) - Number.parseFloat(cs.paddingBottom);
  return content > lh * 2.5;
}

function wrappedOf() {
  return [...document.querySelectorAll("td, th, code, [role=cell]")]
    .filter(tooTall)
    .slice(0, 2)
    .map((el) => (el.textContent || "").trim().slice(0, 24));
}

/** The whole measure of a page. Decorative layers (aria-hidden), fixed elements and anything inside a scroller are left out of the layout probes (yomizaka#435). */
function measurePage() {
  const doc = document.documentElement;
  const panels = [...document.querySelectorAll("[data-panel], main section, main [role=region]")].filter((el) => !el.closest(ARIA_HIDDEN));
  const { overflowing, spill } = spillOf(panels);
  const chips = [...document.querySelectorAll('[data-testid="audience-picker"] a')].map((a) => Math.round(a.getBoundingClientRect().height));
  return {
    h1: document.querySelectorAll("h1").length,
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    wide: wideOf(doc),
    ...unnamedOf(),
    headerAction: headerActionOf(doc),
    chips,
    overflowing: overflowing.slice(0, 3),
    overlaps: overlapsOf(panels, spill).slice(0, 3),
    cutColumns: cutColumnsOf(),
    wrapped: wrappedOf(),
    segmentError: !!document.querySelector('[data-testid="segment-error"]'),
  };
}

const PROBES = [tooTall, wrappedOf, className, nameOf, scrolls, meets, apart, clipped, wideOf, named, unnamedOf, headerActionOf, folded, keptBetween, notDrawn, runsOut, spillOf, overlapsOf, cutBy, cutColumnsOf, measurePage];

/** The expression Playwright runs in the page (`page.evaluate(auditPage)`): the probes, serialised together, then the measure. */
export const auditPage = `(() => {\nconst ARIA_HIDDEN = ${JSON.stringify(ARIA_HIDDEN)};\n${PROBES.map((f) => `const ${f.name} = ${f.toString()};`).join("\n")}\nreturn measurePage();\n})()`;

/**
 * The problems of one page × width × theme, in words: console errors, a horizontal overflow (or elements past the edge),
 * not exactly one h1 (when asked), unnamed buttons, the header's action off screen or unnamed (when the page has one).
 */
export function problemsOf(where, result, { errors = [], h1 = false, headerAction = false } = {}) {
  return [
    ...errorsOf(where, errors),
    ...layoutProblems(where, result),
    ...(h1 ? namingProblems(where, result) : []),
    ...(headerAction ? headerActionProblems(where, result.headerAction) : []),
    ...chipProblems(where, result.chips ?? []),
  ];
}

function errorsOf(where, errors) {
  return errors.length ? [`${where}: console error — ${errors[0]}`] : [];
}

/** Overflow, elements past the edge, boxes that cover or cut one another, a token wrapped per character, the error state. */
function layoutProblems(where, result) {
  const problems = [];
  if (result.scrollWidth > result.clientWidth) problems.push(`${where}: scrollWidth ${result.scrollWidth} > ${result.clientWidth} (${result.wide.join(", ")})`);
  else if (result.wide.length) problems.push(`${where}: elements past the edge (${result.wide.join(", ")})`);
  const lists = [[result.overflowing, "overflows its panel"], [result.overlaps, "covers a neighbouring section"], [result.cutColumns, "is cut off"]];
  for (const [list, words] of lists) {
    if (list?.length) problems.push(`${where}: ${words} (${list.join(", ")})`);
  }
  if (result.wrapped?.length) problems.push(`${where}: a token wraps one character per line (${result.wrapped.join(", ")}) — truncate it`);
  if (result.segmentError) problems.push(`${where}: the page rendered its error state (segment-error), e.g. React #441`);
  return problems;
}

/** Exactly one h1 and every button named. */
function namingProblems(where, result) {
  const problems = [];
  if (result.h1 !== 1) problems.push(`${where}: ${result.h1} h1 (expected exactly one)`);
  if (result.unnamedButtons > 0) {
    const samples = (result.unnamedSamples ?? []).join(" | ");
    problems.push(`${where}: ${result.unnamedButtons} unnamed button(s) ${samples}`.trimEnd());
  }
  return problems;
}

function headerActionProblems(where, action) {
  if (!action) return [`${where}: no header action`];
  if (!action.visible) return [`${where}: the header's action is off screen`];
  return action.named ? [] : [`${where}: the header's action has no accessible name`];
}

function chipProblems(where, chips) {
  return chips.some((h) => h < 44) ? [`${where}: a chip is ${Math.min(...chips)} px tall (< 44)`] : [];
}
