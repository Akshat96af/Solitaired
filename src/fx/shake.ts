// Trauma-based screen shake (Squirrel Eiserloh style): shake = trauma^2.
import { reducedMotion } from "./motion";

let el: HTMLElement | null = null;
let trauma = 0;
let raf = 0;
let last = 0;
let t = 0;
let enabled = true;

export function setShakeTarget(e: HTMLElement | null): void {
  el = e;
  if (!e) {
    trauma = 0;
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

export function setShakeEnabled(v: boolean): void {
  enabled = v;
  if (!v) {
    trauma = 0;
    cancelAnimationFrame(raf);
    raf = 0;
    if (el) el.style.transform = "";
  }
}

const noise = (x: number) => Math.sin(x * 1.7) * 0.5 + Math.sin(x * 2.9 + 1.3) * 0.3 + Math.sin(x * 5.3 + 4.1) * 0.2;

function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  trauma = Math.max(0, trauma - dt * 1.7);
  if (!el) {
    raf = 0;
    return;
  }
  if (trauma <= 0.001) {
    el.style.transform = "";
    raf = 0;
    return;
  }
  const s = trauma * trauma;
  const maxOff = Math.min(window.innerWidth, 900) * 0.022;
  const x = maxOff * s * noise(t * 38);
  const y = maxOff * s * noise(t * 41 + 10);
  const r = 2.4 * s * noise(t * 33 + 20);
  el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${r.toFixed(3)}deg)`;
  raf = requestAnimationFrame(loop);
}

export const shake = {
  add(amount: number): void {
    if (!enabled || !el || document.hidden || reducedMotion()) return;
    trauma = Math.min(1, trauma + amount);
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  },
};
