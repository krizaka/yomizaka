/** A browser has no file system: the storage package bundles its folder store with the settings, and the browser never calls it. */
const unavailable = (): never => {
  throw new Error("No file system in the browser");
};

export const mkdir = unavailable;
export const readdir = unavailable;
export const readFile = unavailable;
export const rm = unavailable;
export const stat = unavailable;
export const writeFile = unavailable;
