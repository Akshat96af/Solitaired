/** Keep imperative effects in sync with the operating system motion preference. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Exponential smoothing with the same response at 60, 120 and 144 Hz. */
export function smoothing(dt: number, response = 20): number {
  return 1 - Math.exp(-response * dt);
}
