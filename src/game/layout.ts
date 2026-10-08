import type { Game, PileRef } from "./types";

export interface Layout {
  W: number;
  H: number;
  cw: number;
  ch: number;
  gap: number;
  x0: number;
  topY: number;
  tabY: number;
  dOff: number; // face-down vertical offset
  uOff: number; // face-up vertical offset
  fan: number; // draw-3 waste fan offset
  radius: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pos {
  x: number;
  y: number;
  z: number;
  rot: number;
}

const CARD_RATIO = 1.4;
const D_OFF = 0.12; // of ch
const U_OFF = 0.3; // of ch
const U_OFF_MIN = 0.2;

export function computeLayout(W: number, H: number): Layout {
  const narrow = W < 520;
  const padX = narrow ? Math.max(4, W * 0.012) : Math.min(32, Math.max(10, W * 0.02));
  const gapRatio = narrow ? 0.09 : 0.14;
  const padTop = narrow ? 8 : 14;
  const cwW = (W - padX * 2) / (7 + 6 * gapRatio);
  // vertical budget for a "typical worst-case" board
  const needRatio = 1 + 0.2 + 1 + 6 * D_OFF + 6 * U_OFF_MIN; // in ch
  const cwH = (H - padTop - 10) / (needRatio * CARD_RATIO);
  const maxCw = 128;
  const cw = Math.max(24, Math.min(cwW, cwH, maxCw));
  const ch = cw * CARD_RATIO;
  const gap = cw * gapRatio;
  const total = cw * 7 + gap * 6;
  const x0 = (W - total) / 2;
  const topY = padTop;
  const rowGap = Math.max(10, ch * 0.2);
  const tabY = topY + ch + rowGap;
  return {
    W,
    H,
    cw,
    ch,
    gap,
    x0,
    topY,
    tabY,
    dOff: ch * D_OFF,
    uOff: ch * U_OFF,
    fan: cw * 0.3,
    radius: cw * 0.075,
  };
}

export function colX(l: Layout, col: number): number {
  return l.x0 + col * (l.cw + l.gap);
}

export function slotRect(l: Layout, p: PileRef): Rect {
  switch (p.type) {
    case "stock":
      return { x: colX(l, 0), y: l.topY, w: l.cw, h: l.ch };
    case "waste":
      return { x: colX(l, 1), y: l.topY, w: l.cw, h: l.ch };
    case "foundation":
      return { x: colX(l, 3 + p.index), y: l.topY, w: l.cw, h: l.ch };
    default:
      return { x: colX(l, p.index), y: l.tabY, w: l.cw, h: l.ch };
  }
}

/** Per-column vertical offsets (compressed when a column would overflow). */
export function columnOffsets(l: Layout, nDown: number, nUp: number): { d: number; u: number } {
  const avail = l.H - l.tabY - l.ch - 8;
  const need = nDown * l.dOff + Math.max(0, nUp - 1) * l.uOff;
  if (need <= avail || need <= 0) return { d: l.dOff, u: l.uOff };
  const s = Math.max(0.3, avail / need);
  return { d: l.dOff * s, u: l.uOff * s };
}

function rnd(id: number, k: number): number {
  const s = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function dealOrder(col: number, row: number): number {
  return 7 * row - (row * (row - 1)) / 2 + (col - row);
}

/**
 * Computes the position of every card (indexed by card id).
 * stage 0: scattered at table centre, 1: gathered on the stock slot, >=2: real layout.
 */
export function computePositions(g: Game, l: Layout, stage: number): Pos[] {
  const out: Pos[] = new Array(52);
  const stockR = slotRect(l, { type: "stock", index: 0 });

  if (stage < 2) {
    const cx = (l.W - l.cw) / 2;
    const cy = (l.H - l.ch) / 2;
    const place = (id: number, z: number) => {
      if (stage === 0) {
        out[id] = {
          x: cx + (rnd(id, 1) - 0.5) * l.cw * 2.6,
          y: cy + (rnd(id, 2) - 0.5) * l.ch * 0.8,
          z,
          rot: (rnd(id, 3) - 0.5) * 80,
        };
      } else {
        out[id] = { x: stockR.x, y: stockR.y, z, rot: 0 };
      }
    };
    g.stock.forEach((c, i) => place(c.id, i));
    for (let c = 0; c < 7; c++) {
      g.tableau[c].forEach((card, r) => place(card.id, 24 + (27 - dealOrder(c, r))));
    }
    // (waste/foundations are empty at deal time, but be safe)
    g.waste.forEach((c, i) => place(c.id, 60 + i));
    g.foundations.forEach((f) => f.forEach((c, i) => place(c.id, 70 + i)));
    return out;
  }

  g.stock.forEach((c, i) => {
    out[c.id] = { x: stockR.x, y: stockR.y, z: i + 1, rot: 0 };
  });

  const wasteR = slotRect(l, { type: "waste", index: 0 });
  const n = g.waste.length;
  const fanN = g.drawCount === 3 ? Math.min(g.fan, n) : 0;
  const fanStart = n - fanN;
  g.waste.forEach((c, i) => {
    out[c.id] = {
      x: wasteR.x + (fanN > 0 && i >= fanStart ? (i - fanStart) * l.fan : 0),
      y: wasteR.y,
      z: i + 1,
      rot: 0,
    };
  });

  g.foundations.forEach((f, fi) => {
    const r = slotRect(l, { type: "foundation", index: fi });
    f.forEach((c, i) => {
      out[c.id] = { x: r.x, y: r.y, z: i + 1, rot: 0 };
    });
  });

  g.tableau.forEach((col, ci) => {
    const x = colX(l, ci);
    const nDown = col.reduce((a, c) => a + (c.up ? 0 : 1), 0);
    const { d, u } = columnOffsets(l, nDown, col.length - nDown);
    let y = l.tabY;
    col.forEach((c, i) => {
      out[c.id] = { x, y, z: i + 1, rot: 0 };
      y += c.up ? u : d;
    });
  });

  return out;
}

/** Rect of the "landing" area of a pile, used for drop detection & rings. */
export function topCardRect(g: Game, l: Layout, pos: Pos[], p: PileRef): Rect {
  const slot = slotRect(l, p);
  const cards = p.type === "stock" ? g.stock : p.type === "waste" ? g.waste : p.type === "foundation" ? g.foundations[p.index] : g.tableau[p.index];
  if (!cards.length) return slot;
  const last = cards[cards.length - 1];
  const ps = pos[last.id];
  if (!ps) return slot;
  return { x: ps.x, y: ps.y, w: l.cw, h: l.ch };
}

/** Rect spanning a tableau run from card index `idx` to the end. */
export function runRect(g: Game, l: Layout, pos: Pos[], p: PileRef, idx: number): Rect {
  const cards = p.type === "tableau" ? g.tableau[p.index] : p.type === "waste" ? g.waste : p.type === "foundation" ? g.foundations[p.index] : g.stock;
  if (!cards.length || idx < 0 || idx >= cards.length) return slotRect(l, p);
  const a = pos[cards[idx].id];
  const b = pos[cards[cards.length - 1].id];
  return { x: a.x, y: a.y, w: l.cw, h: b.y - a.y + l.ch };
}

export function dropRect(g: Game, l: Layout, pos: Pos[], p: PileRef): Rect {
  if (p.type === "foundation") {
    const r = slotRect(l, p);
    return { x: r.x - l.gap * 0.5, y: r.y - 6, w: r.w + l.gap, h: r.h + 12 };
  }
  const col = g.tableau[p.index];
  const base = slotRect(l, p);
  let bottom = base.y + base.h;
  if (col.length) {
    const last = pos[col[col.length - 1].id];
    if (last) bottom = last.y + l.ch;
  }
  return { x: base.x - l.gap * 0.5, y: base.y, w: base.w + l.gap, h: bottom + l.ch * 0.35 - base.y };
}
