import { useEffect } from "react";

/**
 * Locks body scroll when `locked` is true.
 * Uses the position:fixed technique which works reliably on iOS Safari.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const scrollY = window.scrollY;
    document.body.style.cssText = `position:fixed;top:-${scrollY}px;left:0;right:0;overflow-y:scroll;`;
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
