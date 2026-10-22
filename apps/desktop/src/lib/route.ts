/**
 * The URL is the state, in the window too: the screen is the hash, so a refresh, the back button and a link kept in the
 * notes all come back to the same place.
 *
 *   #/library                  the folders
 *   #/library/<folder>         one folder's documents (the folder's path, encoded)
 *   #/check/<document>/<run>   a check being followed
 *   #/settings
 */
export type Route =
  | { screen: "library"; folder: string | null }
  | { screen: "check"; documentId: string; analysisId: string }
  | { screen: "settings" };

export const HOME: Route = { screen: "library", folder: null };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "check" && parts[1] && parts[2]) return { screen: "check", documentId: parts[1], analysisId: parts[2] };
  if (parts[0] === "settings") return { screen: "settings" };
  if (parts[0] === "library" && parts[1]) return { screen: "library", folder: parts[1] };
  return HOME;
}

export function hashOf(route: Route): string {
  switch (route.screen) {
    case "check":
      return `#/check/${encodeURIComponent(route.documentId)}/${encodeURIComponent(route.analysisId)}`;
    case "settings":
      return "#/settings";
    case "library":
      return route.folder ? `#/library/${encodeURIComponent(route.folder)}` : "#/library";
  }
}
