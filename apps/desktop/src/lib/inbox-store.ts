import { createInbox } from "./inbox";

/** The watched folders of this Mac, in the page's storage (folders and file names only, never a document). */
export const inbox = createInbox({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
});
