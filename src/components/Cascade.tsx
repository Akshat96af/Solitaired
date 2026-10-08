import { useEffect, useRef } from "react";
import type { Card } from "../game/types";
import { RANK_LABELS, isRed } from "../game/types";
import { suitPath2D, SUIT_COLOR_BLACK, SUIT_COLOR_RED } from "../game/suits";
import { boardApi } from "../fx/effects";
import type { Rect } from "../game/layout";
import { sfx } from "../fx/audio";
import { reducedMotion } from "../fx/motion";

function roundRectPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawSuit(c: CanvasRenderingContext2D, suit: number, x: number, y: number, size: number) {
  c.save();
  c.translate(x, y);
  c.scale(size / 100, size / 100);
  c.fill(suitPath2D(suit));
  c.restore();
}

function makeSprite(card: Card, cw: number, ch: number, dpr: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(cw * dpr);
  cv.height = Math.ceil(ch * dpr);
  const c = cv.getContext("2d")!;
  c.scale(dpr, dpr);
  const r = cw * 0.075;
  const g = c.createLinearGradient(0, 0, cw, ch);
  g.addColorStop(0, "#fffefa");
  g.addColorStop(1, "#ebe3d0");
  roundRectPath(c, 0.5, 0.5, cw - 1, ch - 1, r);
  c.fillStyle = g;
  c.fill();
  c.lineWidth = 1;
  c.strokeStyle = "rgba(70,48,10,0.45)";
  c.stroke();

  const color = isRed(card.suit) ? SUIT_COLOR_RED : SUIT_COLOR_BLACK;
  c.fillStyle = color;
  const label = RANK_LABELS[card.rank];
  c.font = `800 ${cw * 0.25}px "Playfair Display", Georgia, serif`;
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  const drawIndex = () => {
    c.fillText(label, cw * 0.17, ch * 0.18);
    drawSuit(c, card.suit, cw * 0.09, ch * 0.205, cw * 0.16);
  };
  drawIndex();
  c.save();
  c.translate(cw, ch);
  c.rotate(Math.PI);
  drawIndex();
  c.restore();
  const big = card.rank >= 11 ? cw * 0.38 : card.rank === 1 ? cw * 0.48 : cw * 0.34;
  drawSuit(c, card.suit, cw / 2 - big / 2, ch / 2 - big / 2, big);
  if (card.rank >= 11) {
    c.font = `900 ${cw * 0.5}px "Playfair Display", Georgia, serif`;
    c.globalAlpha = 0.12;
    c.fillText(label, cw / 2, ch * 0.66);
    c.globalAlpha = 1;
  }
  return cv;
}

interface Flyer {
  sprite: HTMLCanvasElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Windows-style victory cascade: every card bounces off the floor leaving a trail. */
export function Cascade({ foundations, onDone }: { foundations: Card[][]; onDone?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (reducedMotion()) { doneRef.current?.(); return; }
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { cw, ch } = boardApi.getCardSize();
    const rects: Rect[] = boardApi.getFoundationRects();
    const s = Math.max(0.6, ch / 150);

    // launch queue: round-robin across foundations, kings first
    const piles = foundations.map((f) => f.slice().reverse());
    const queue: { card: Card; rect: Rect }[] = [];
    let more = true;
    let layer = 0;
    while (more) {
      more = false;
      for (let i = 0; i < piles.length; i++) {
        if (layer < piles[i].length) {
          queue.push({ card: piles[i][layer], rect: rects[i] });
          more = true;
        }
      }
      layer++;
    }

    const flyers: Flyer[] = [];
    let qi = 0;
    let raf = 0;
    let last = performance.now();
    let sinceLaunch = 0;
    let startTimer = 0;
    let alive = true;
    const interval = 150;
    const gravity = 0.52 * s;
    const floorY = H - H * 0.085; // rests on the cinematic letterbox bar

    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(2.5, (now - last) / 16.667);
      last = now;
      sinceLaunch += dt * 16.667;
      while (qi < queue.length && sinceLaunch >= interval) {
        sinceLaunch -= interval;
        const q = queue[qi++];
        boardApi.hideCard(q.card.id);
        const dir = Math.random() < 0.5 ? -1 : 1;
        flyers.push({
          sprite: makeSprite(q.card, cw, ch, dpr),
          x: q.rect.x,
          y: q.rect.y,
          vx: dir * (2.6 + Math.random() * 4.4) * s,
          vy: -(Math.random() * 7.5) * s,
        });
        if (qi % 4 === 1) sfx.chime(Math.min(12, Math.floor(qi / 4) + 2));
      }
      for (let i = flyers.length - 1; i >= 0; i--) {
        const f = flyers[i];
        f.vy += gravity * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.y + ch > floorY) {
          f.y = floorY - ch;
          f.vy = -f.vy * 0.8;
          if (Math.abs(f.vy) < 1.2 * s) f.vy = -(2 + Math.random() * 3) * s;
        }
        ctx.drawImage(f.sprite, f.x, f.y, cw, ch);
        if (f.x > W + 10 || f.x < -cw - 10) flyers.splice(i, 1);
      }
      if (qi >= queue.length && flyers.length === 0) {
        doneRef.current?.();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    startTimer = window.setTimeout(() => {
      last = performance.now();
      sinceLaunch = interval;
      raf = requestAnimationFrame(frame);
    }, 750);

    return () => {
      alive = false;
      window.clearTimeout(startTimer);
      cancelAnimationFrame(raf);
      boardApi.showAllCards();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[65]" />;
}
