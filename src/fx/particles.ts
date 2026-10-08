// Lightweight canvas particle engine: additive sparks, stars, rings and floating text.
// The render loop only runs while particles are alive.
import { reducedMotion } from "./motion";

const MAX_PARTICLES = 180;
const canEmit = () => !!ctx && !document.hidden && !reducedMotion() && parts.length < MAX_PARTICLES;

const enum K {
  Spark = 0,
  Ring = 1,
  Text = 2,
  Star = 3,
}

interface Particle {
  k: K;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  life: number;
  max: number;
  size: number;
  size1: number;
  color: string;
  text: string;
  rot: number;
  vr: number;
  lw: number;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;
let W = 0;
let H = 0;
const parts: Particle[] = [];
let raf = 0;
let last = 0;
const sprites = new Map<string, HTMLCanvasElement>();

function glow(color: string): HTMLCanvasElement {
  let s = sprites.get(color);
  if (s) return s;
  s = document.createElement("canvas");
  s.width = s.height = 64;
  const c = s.getContext("2d")!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.22, color);
  g.addColorStop(0.55, color + "55");
  g.addColorStop(1, color + "00");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  sprites.set(color, s);
  return s;
}

function resize(): void {
  if (!canvas) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
}

export function attach(c: HTMLCanvasElement | null): void {
  if (!c) {
    clear();
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas = null;
    ctx = null;
    return;
  }
  canvas = c;
  ctx = c.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVisibility);
}

function onVisibility() {
  if (document.hidden) clear();
}

function start(): void {
  if (!raf && ctx) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function mk(p: Partial<Particle> & { k: K; x: number; y: number }): Particle {
  return {
    vx: 0,
    vy: 0,
    g: 0,
    drag: 0.96,
    life: 0,
    max: 0.8,
    size: 8,
    size1: 0,
    color: "#ffd36a",
    text: "",
    rot: 0,
    vr: 0,
    lw: 3,
    ...p,
  };
}

export interface BurstOpts {
  count?: number;
  speed?: number;
  angle?: number; // radians, centre of cone (default: full circle)
  spread?: number; // radians (default: 2π)
  life?: number;
  size?: number;
  colors?: string[];
  gravity?: number;
  drag?: number;
  stars?: number;
}

export function burst(x: number, y: number, o: BurstOpts = {}): void {
  if (!canEmit()) return;
  const count = Math.min(60, o.count ?? 16, MAX_PARTICLES - parts.length);
  const colors = o.colors ?? ["#ffd36a", "#fff1b8", "#ffb347"];
  const spread = o.spread ?? Math.PI * 2;
  const angle = o.angle ?? 0;
  for (let i = 0; i < count; i++) {
    const a = o.spread === undefined ? Math.random() * Math.PI * 2 : angle + (Math.random() - 0.5) * spread;
    const sp = (o.speed ?? 260) * rand(0.35, 1);
    parts.push(
      mk({
        k: K.Spark,
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: o.gravity ?? 420,
        drag: o.drag ?? 0.94,
        max: (o.life ?? 0.8) * rand(0.6, 1.1),
        size: (o.size ?? 9) * rand(0.5, 1.1),
        color: colors[(Math.random() * colors.length) | 0],
      }),
    );
  }
  const stars = Math.min(o.stars ?? 0, MAX_PARTICLES - parts.length);
  for (let i = 0; i < stars; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (o.speed ?? 260) * rand(0.2, 0.7);
    parts.push(
      mk({
        k: K.Star,
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: (o.gravity ?? 420) * 0.4,
        drag: 0.93,
        max: (o.life ?? 0.8) * rand(0.9, 1.5),
        size: (o.size ?? 9) * rand(1.2, 2),
        color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * Math.PI,
        vr: rand(-4, 4),
      }),
    );
  }
  start();
}

export function ring(x: number, y: number, o: { color?: string; radius?: number; life?: number; width?: number } = {}): void {
  if (!canEmit()) return;
  parts.push(
    mk({
      k: K.Ring,
      x,
      y,
      size: (o.radius ?? 60) * 0.15,
      size1: o.radius ?? 60,
      max: o.life ?? 0.55,
      color: o.color ?? "#ffe08a",
      lw: o.width ?? 4,
    }),
  );
  start();
}

export function text(x: number, y: number, str: string, o: { color?: string; size?: number; life?: number; rise?: number } = {}): void {
  if (!canEmit()) return;
  parts.push(
    mk({
      k: K.Text,
      x,
      y,
      vy: -(o.rise ?? 70),
      max: o.life ?? 1.0,
      size: o.size ?? 26,
      color: o.color ?? "#fff1b8",
      text: str,
    }),
  );
  start();
}

export function twinkle(x: number, y: number, color = "#fff1b8"): void {
  if (!canEmit()) return;
  parts.push(
    mk({
      k: K.Star,
      x,
      y,
      vx: rand(-14, 14),
      vy: rand(-26, 4),
      g: 40,
      drag: 0.98,
      max: rand(0.35, 0.6),
      size: rand(5, 9),
      color,
      rot: Math.random() * Math.PI,
      vr: rand(-3, 3),
    }),
  );
  start();
}

export function clear(): void {
  cancelAnimationFrame(raf);
  raf = 0;
  parts.length = 0;
  if (ctx && canvas) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function drawStar(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.beginPath();
  c.moveTo(0, -r);
  c.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0);
  c.quadraticCurveTo(r * 0.12, r * 0.12, 0, r);
  c.quadraticCurveTo(-r * 0.12, r * 0.12, -r, 0);
  c.quadraticCurveTo(-r * 0.12, -r * 0.12, 0, -r);
  c.fill();
  c.restore();
}

function frame(now: number): void {
  raf = 0;
  const c = ctx;
  if (!c || !canvas) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life += dt;
    if (p.life >= p.max) {
      parts[i] = parts[parts.length - 1];
      parts.pop();
      continue;
    }
    const t = p.life / p.max;
    switch (p.k) {
      case K.Spark: {
        const k = Math.pow(p.drag, dt * 60);
        p.vx *= k;
        p.vy = p.vy * k + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = Math.pow(1 - t, 1.3);
        const s = p.size * (1 - t * 0.55);
        c.drawImage(glow(p.color), p.x - s, p.y - s, s * 2, s * 2);
        break;
      }
      case K.Star: {
        const k = Math.pow(p.drag, dt * 60);
        p.vx *= k;
        p.vy = p.vy * k + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = Math.sin(Math.PI * Math.min(1, t * 1.1));
        c.fillStyle = p.color;
        drawStar(c, p.x, p.y, p.size * (0.6 + 0.4 * Math.sin(Math.PI * t)), p.rot);
        break;
      }
      case K.Ring: {
        const e = 1 - Math.pow(1 - t, 3);
        const r = p.size + (p.size1 - p.size) * e;
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = (1 - t) * 0.9;
        c.strokeStyle = p.color;
        c.lineWidth = Math.max(0.5, p.lw * (1 - t));
        c.beginPath();
        c.arc(p.x, p.y, r, 0, Math.PI * 2);
        c.stroke();
        break;
      }
      case K.Text: {
        p.y += p.vy * dt;
        p.vy *= Math.pow(0.94, dt * 60);
        c.globalCompositeOperation = "source-over";
        const pop = t < 0.14 ? 0.55 + (t / 0.14) * 0.6 : t < 0.26 ? 1.15 - ((t - 0.14) / 0.12) * 0.15 : 1;
        c.globalAlpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
        c.font = `800 ${p.size * pop}px Inter, system-ui, sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.lineWidth = 5;
        c.strokeStyle = "rgba(0,0,0,0.55)";
        c.lineJoin = "round";
        c.strokeText(p.text, p.x, p.y);
        c.fillStyle = p.color;
        c.fillText(p.text, p.x, p.y);
        break;
      }
    }
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
  if (parts.length) raf = requestAnimationFrame(frame);
  else c.clearRect(0, 0, W, H);
}
