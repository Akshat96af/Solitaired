import { useCallback, useEffect, useRef } from "react";

/** Timed UI work must not survive its owning screen. */
export function useTimeouts() {
  const timers = useRef(new Set<number>());
  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    timers.current.clear();
  }, []);
  return useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);
}
