import confetti from "canvas-confetti";
import type { Game, PileRef } from "../game/types";
import type { Rect } from "../game/layout";
import { SUIT_PATHS } from "../game/suits";
import { sfx, vibrate } from "./audio";
import * as P from "./particles";
import { shake } from "./shake";
import { reducedMotion } from "./motion";

/** Registry the Board fills in so effects can find things in viewport space. */
export const boardApi = {
  /** When set, pile rects are computed against this (post-move) game state. */
  overrideGame: null as Game | null,
  getPileRect: (_p: PileRef): Rect | null => null,
  getFoundationRects: (): Rect[] => [],
  getCardSize: (): { cw: number; ch: number } => ({ cw: 70, ch: 98 }),
  flash: (_color?: string): void => {},
  hideCard: (_id: number): void => {},
  showAllCards: (): void => {},
};

const GOLD = ["#ffd36a", "#fff1b8", "#ffb347"];
const MINT = ["#9bffd8", "#e6fff5", "#5be3b0"];
const RED = ["#ff7a8a", "#ffc2cb", "#ff4d6d"];

const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

let shapes: confetti.Shape[] | null = null;
function suitShapes(): confetti.Shape[] {
  if (!shapes) {
    try {
      shapes = SUIT_PATHS.map((path) => confetti.shapeFromPath({ path }));
    } catch {
      shapes = [];
    }
  }
  return shapes;
}

function suitConfetti(x: number, y: number, count: number, spread = 80, angle = 90, velocity = 42) {
  if (document.hidden || reducedMotion()) return;
  const sh = suitShapes();
  if (!sh.length) {
    confetti({ particleCount: count, spread, angle, origin: { x: x / window.innerWidth, y: y / window.innerHeight } });
    return;
  }
  const origin = { x: x / window.innerWidth, y: y / window.innerHeight };
  const red = [sh[1], sh[2]];
  const dark = [sh[0], sh[3]];
  const base = { spread, angle, startVelocity: velocity, origin, scalar: 2.1, ticks: 230, gravity: 0.95, zIndex: 120 };
  confetti({ ...base, particleCount: Math.ceil(count / 2), shapes: red, colors: ["#ff4d6d", "#ff8fa3", "#ffd166"] });
  confetti({ ...base, particleCount: Math.floor(count / 2), shapes: dark, colors: ["#ffffff", "#f1e6c2", "#ffd166", "#7ae7c7"] });
}

let winTimers: number[] = [];

export const fb = {
  draw(recycled: boolean, penalty: number) {
    sfx.flick();
    vibrate(5);
    if (recycled) {
      sfx.whoosh(false);
      shake.add(0.16);
      const r = boardApi.getPileRect({ type: "stock", index: 0 });
      if (r) {
        const c = center(r);
        P.ring(c.x, c.y, { color: "#9bffd8", radius: r.w * 1.1, width: 3 });
        P.burst(c.x, c.y, { count: 14, colors: MINT, speed: 220, size: 8, gravity: 80 });
        if (penalty < 0) P.text(c.x, c.y - r.h * 0.5, String(penalty), { color: "#ff8a8a", size: 24 });
      }
    }
  },

  select() {
    sfx.pick();
    vibrate(4);
  },

  place(to: PileRef, delta: number, count: number) {
    sfx.thud();
    vibrate(8);
    shake.add(0.07 + Math.min(count, 6) * 0.012);
    const r = boardApi.getPileRect(to);
    if (r) {
      const c = center(r);
      P.burst(c.x, r.y + r.h * 0.85, {
        count: 7,
        colors: ["#e6fff5", "#9fd8bf"],
        speed: 120,
        size: 6,
        gravity: 160,
        angle: -Math.PI / 2,
        spread: Math.PI * 1.1,
        life: 0.45,
      });
      if (delta > 0) P.text(c.x, r.y + r.h * 0.2, `+${delta}`, { color: "#bfffe4", size: 22 });
      else if (delta < 0) P.text(c.x, r.y + r.h * 0.2, String(delta), { color: "#ff8a8a", size: 22 });
    }
  },

  foundation(to: PileRef, rank: number, combo: number, complete: boolean, delta: number) {
    sfx.thud();
    window.setTimeout(() => sfx.chime(Math.min(12, rank - 1 + Math.max(0, combo - 1))), 40);
    vibrate([10, 20, 14]);
    shake.add(0.2 + Math.min(combo, 6) * 0.03);
    const r = boardApi.getPileRect(to);
    if (!r) return;
    const c = center(r);
    P.ring(c.x, c.y, { color: "#ffe08a", radius: r.w * 1.25, width: 5 });
    P.burst(c.x, c.y, { count: 22 + combo * 3, colors: GOLD, speed: 340, size: 10, stars: 5, gravity: 380 });
    P.text(c.x, r.y + r.h * 0.9, `+${delta}`, { color: "#ffe9a0", size: 26, rise: 80 });
    if (combo >= 2) {
      P.text(c.x, r.y + r.h * 1.45, `COMBO ×${combo}`, { color: "#ffb347", size: 20, life: 1.1, rise: 40 });
    }
    if (complete) {
      sfx.complete();
      shake.add(0.5);
      boardApi.flash("#ffe9a0");
      P.ring(c.x, c.y, { color: "#ffffff", radius: r.w * 2.6, width: 7, life: 0.8 });
      P.burst(c.x, c.y, { count: 70, colors: GOLD, speed: 520, size: 12, stars: 12, gravity: 300, life: 1.2 });
      P.text(c.x, r.y + r.h * 1.9, "SUIT COMPLETE", { color: "#fff1b8", size: 24, life: 1.6, rise: 30 });
      suitConfetti(c.x, c.y, 46, 120, 90, 38);
    }
  },

  flip() {
    sfx.flip();
    vibrate(3);
  },

  invalid() {
    sfx.error();
    vibrate(24);
    shake.add(0.16);
  },

  undo() {
    sfx.undo();
    vibrate(6);
  },

  hint(to: PileRef | null) {
    sfx.hint();
    if (to) {
      const r = boardApi.getPileRect(to);
      if (r) {
        const c = center(r);
        P.ring(c.x, c.y, { color: "#9bffd8", radius: r.w * 0.9, width: 3 });
      }
    }
  },

  twinkleAt(x: number, y: number) {
    P.twinkle(x, y);
  },

  lowestToast(x: number, y: number, str: string) {
    P.text(x, y, str, { color: "#ff8a8a", size: 20 });
  },

  stuck() {
    sfx.stuck();
    shake.add(0.35);
    vibrate([30, 40, 30]);
    boardApi.flash("#ff5a5a");
  },

  win() {
    sfx.win();
    shake.add(0.9);
    vibrate([20, 30, 20, 30, 60]);
    boardApi.flash("#ffffff");
    const W = window.innerWidth;
    const H = window.innerHeight;
    winTimers.forEach((t) => window.clearTimeout(t));
    winTimers = [];
    winTimers.push(window.setTimeout(() => boardApi.flash("#ffe9a0"), 380));
    const volley = (delay: number, left: boolean) => {
      winTimers.push(
        window.setTimeout(() => {
          suitConfetti(left ? W * 0.04 : W * 0.96, H * 0.82, 34, 62, left ? 62 : 118, 58);
        }, delay),
      );
    };
    [0, 350, 800, 1300, 1900, 2600].forEach((d, i) => volley(d, i % 2 === 0));
    winTimers.push(window.setTimeout(() => suitConfetti(W * 0.5, H * 0.35, 60, 360, 90, 32), 500));
    for (let i = 0; i < 5; i++) {
      winTimers.push(
        window.setTimeout(() => {
          P.burst(W * (0.15 + Math.random() * 0.7), H * (0.15 + Math.random() * 0.4), {
            count: 40,
            colors: Math.random() > 0.5 ? GOLD : RED,
            speed: 420,
            size: 12,
            stars: 6,
            gravity: 260,
            life: 1.1,
          });
          shake.add(0.12);
        }, 250 + i * 420),
      );
    }
  },

  stopWin() {
    P.clear();
    winTimers.forEach((t) => window.clearTimeout(t));
    winTimers = [];
    try {
      confetti.reset();
    } catch {
      /* ignore */
    }
  },
};
