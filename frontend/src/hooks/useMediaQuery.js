import { useEffect, useState } from "react";
import { breakpoint } from "../design-system/tokens";

/**
 * Subscribe to a media query.
 *
 * Layout belongs in CSS wherever CSS can express it. This is for the
 * cases it cannot: deciding whether to *render* a bottom nav at all,
 * rather than rendering it and hiding it. A nav that exists in the DOM
 * but is display:none is still reachable by a screen reader, so the
 * decision has to happen in JS.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True below the tablet breakpoint — bottom nav territory. */
export const useIsMobile = () => useMediaQuery(`(max-width: ${breakpoint.md - 1}px)`);

/** True below the laptop breakpoint — the sidebar is a rail or gone. */
export const useIsCompact = () => useMediaQuery(`(max-width: ${breakpoint.lg - 1}px)`);
