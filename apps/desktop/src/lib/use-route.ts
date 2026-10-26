import { useCallback, useEffect, useState } from "react";

import { hashOf, parseRoute, type Route } from "./route";

/** The route is the window's hash: `go` writes it, the back button and a changed hash read it. */
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(globalThis.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(globalThis.location.hash));
    globalThis.addEventListener("hashchange", onChange);
    return () => globalThis.removeEventListener("hashchange", onChange);
  }, []);
  const go = useCallback((next: Route) => {
    globalThis.location.hash = hashOf(next);
  }, []);
  return [route, go];
}
