// Shared by the recording scripts (landing-journey, showcase-web): chromium, the --flag reader and the e-mail hider.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const { chromium } = require("playwright-core");

/** Reads `--name value` from the command line, or the fallback. */
export const flagReader = (args) => (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

/** Init script: hides any element that shows an e-mail address (the sidebar's « Signed in as »): nothing personal on screen. */
export const hideEmail = () => {
  const hide = () => {
    for (const el of document.querySelectorAll("body *")) {
      if (el.childElementCount === 0 && /@[a-z0-9.-]+\.[a-z]{2,}/i.test(el.textContent ?? "")) el.style.visibility = "hidden";
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    hide();
    new MutationObserver(hide).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
};
