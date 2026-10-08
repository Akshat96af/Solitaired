import type { Card, Game, Hint, Move, PileRef, Suit } from "./types";
import { isRed } from "./types";

/* ------------------------------------------------------------------ */
/* Deterministic RNG + dealing                                         */
/* ------------------------------------------------------------------ */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

export function dailySeed(d: Date = new Date()): number {
  const n = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  // scramble so neighbouring days feel unrelated
  return Math.imul(n, 2654435761) >>> 0;
}

export function makeCard(id: number, up = false): Card {
  return { id, suit: Math.floor(id / 13) as Suit, rank: (id % 13) + 1, up };
}

export function deal(seed: number, drawCount: 1 | 3): Game {
  const rnd = mulberry32(seed);
  const ids = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = ids[i];
    ids[i] = ids[j];
    ids[j] = tmp;
  }
  let p = 0;
  const tableau: Card[][] = [];
  for (let c = 0; c < 7; c++) {
    const col: Card[] = [];
    for (let r = 0; r <= c; r++) col.push(makeCard(ids[p++], r === c));
    tableau.push(col);
  }
  const stock = ids.slice(p).map((id) => makeCard(id, false));
  return {
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    fan: 0,
    score: 0,
    moves: 0,
    recycles: 0,
    drawCount,
    seed,
  };
}

export function cloneGame(g: Game): Game {
  return {
    ...g,
    stock: g.stock.slice(),
    waste: g.waste.slice(),
    foundations: g.foundations.map((f) => f.slice()),
    tableau: g.tableau.map((t) => t.slice()),
  };
}

export function getPile(g: Game, ref: PileRef): Card[] {
  switch (ref.type) {
    case "stock":
      return g.stock;
    case "waste":
      return g.waste;
    case "foundation":
      return g.foundations[ref.index];
    default:
      return g.tableau[ref.index];
  }
}

export function isWon(g: Game): boolean {
  return g.foundations.every((f) => f.length === 13);
}

export function foundationCount(g: Game): number {
  return g.foundations.reduce((n, f) => n + f.length, 0);
}

export function faceDownCount(g: Game): number {
  let n = 0;
  for (const col of g.tableau) for (const c of col) if (!c.up) n++;
  return n;
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export function canPlaceOnTableau(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.rank === 13;
  const top = pile[pile.length - 1];
  return top.up && isRed(top.suit) !== isRed(card.suit) && top.rank === card.rank + 1;
}

export function canPlaceOnFoundation(cards: Card[], pile: Card[]): boolean {
  if (cards.length !== 1) return false;
  const c = cards[0];
  if (pile.length === 0) return c.rank === 1;
  const top = pile[pile.length - 1];
  return top.suit === c.suit && top.rank + 1 === c.rank;
}

/** Is card at `idx` in `pile` a valid thing to pick up? */
export function isSource(g: Game, pile: PileRef, idx: number): boolean {
  const cards = getPile(g, pile);
  if (idx < 0 || idx >= cards.length) return false;
  if (!cards[idx].up) return false;
  if (pile.type === "tableau") return true;
  if (pile.type === "waste" || pile.type === "foundation") return idx === cards.length - 1;
  return false;
}

function isValidRun(cards: Card[]): boolean {
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].up) return false;
    if (i > 0) {
      const a = cards[i - 1];
      const b = cards[i];
      if (isRed(a.suit) === isRed(b.suit) || a.rank !== b.rank + 1) return false;
    }
  }
  return true;
}

export function isLegalMove(g: Game, m: Move): boolean {
  if (m.from.type === "stock") return false;
  if (m.to.type === "stock" || m.to.type === "waste") return false;
  const src = getPile(g, m.from);
  if (m.count < 1 || m.count > src.length) return false;
  if (m.from.type !== "tableau" && m.count !== 1) return false;
  const cards = src.slice(src.length - m.count);
  if (!isValidRun(cards)) return false;
  if (m.to.type === "tableau") {
    if (m.from.type === "tableau" && m.from.index === m.to.index) return false;
    return canPlaceOnTableau(cards[0], g.tableau[m.to.index]);
  }
  // foundation
  if (m.from.type === "foundation") return false;
  return canPlaceOnFoundation(cards, g.foundations[m.to.index]);
}

export function foundationSlotFor(g: Game, card: Card): number {
  for (let i = 0; i < 4; i++) {
    const f = g.foundations[i];
    if (f.length && f[f.length - 1].suit === card.suit && f[f.length - 1].rank + 1 === card.rank) return i;
  }
  if (card.rank === 1) {
    for (let i = 0; i < 4; i++) if (g.foundations[i].length === 0) return i;
  }
  return -1;
}

/* ------------------------------------------------------------------ */
/* Applying actions                                                    */
/* ------------------------------------------------------------------ */

export interface MoveResult {
  game: Game;
  delta: number; // actual score change after clamping at 0
  flipped: number | null; // id of the tableau card that got turned face-up
  foundationSlot: number; // >= 0 when the move landed on a foundation
}

export function applyMove(g: Game, m: Move): MoveResult | null {
  if (!isLegalMove(g, m)) return null;
  const next = cloneGame(g);
  const src = getPile(next, m.from);
  const dst = getPile(next, m.to);
  const moved = src.splice(src.length - m.count, m.count);
  dst.push(...moved);

  let raw = 0;
  let foundationSlot = -1;
  if (m.to.type === "foundation") {
    raw += 10;
    foundationSlot = m.to.index;
  } else if (m.to.type === "tableau") {
    if (m.from.type === "waste") raw += 5;
    else if (m.from.type === "foundation") raw -= 15;
  }

  let flipped: number | null = null;
  if (m.from.type === "tableau" && src.length > 0 && !src[src.length - 1].up) {
    const top = src[src.length - 1];
    src[src.length - 1] = { ...top, up: true };
    flipped = top.id;
    raw += 5;
  }

  if (m.from.type === "waste") {
    next.fan = Math.min(Math.max(next.fan - 1, 1), next.waste.length);
  }

  next.moves = g.moves + 1;
  const newScore = Math.max(0, g.score + raw);
  next.score = newScore;
  return { game: next, delta: newScore - g.score, flipped, foundationSlot };
}

export interface DrawResult {
  game: Game;
  delta: number;
  recycled: boolean;
  drawn: number;
}

export function drawFromStock(g: Game, free = false): DrawResult | null {
  if (g.stock.length === 0 && g.waste.length === 0) return null;
  const next = cloneGame(g);
  let raw = 0;
  let recycled = false;
  let drawn = 0;
  if (next.stock.length === 0) {
    // recycle waste back into the stock (reverse order, face down)
    next.stock = next.waste
      .slice()
      .reverse()
      .map((c) => ({ ...c, up: false }));
    next.waste = [];
    next.fan = 0;
    next.recycles = g.recycles + 1;
    recycled = true;
    if (!free) {
      if (g.drawCount === 1) raw -= 100;
      else if (next.recycles >= 3) raw -= 20;
    }
  } else {
    const n = Math.min(g.drawCount, next.stock.length);
    for (let i = 0; i < n; i++) {
      const c = next.stock.pop()!;
      next.waste.push({ ...c, up: true });
    }
    next.fan = n;
    drawn = n;
  }
  next.moves = g.moves + 1;
  const newScore = Math.max(0, g.score + raw);
  next.score = newScore;
  return { game: next, delta: newScore - g.score, recycled, drawn };
}

/* ------------------------------------------------------------------ */
/* Auto-move / hints                                                   */
/* ------------------------------------------------------------------ */

export function findAutoMove(g: Game, from: PileRef, count: number): Move | null {
  const src = getPile(g, from);
  if (count < 1 || count > src.length) return null;
  const cards = src.slice(src.length - count);
  if (!cards[0].up) return null;
  if (from.type === "foundation") return null;
  if (count === 1) {
    const s = foundationSlotFor(g, cards[0]);
    if (s >= 0) {
      const m: Move = { from, to: { type: "foundation", index: s }, count: 1 };
      if (isLegalMove(g, m)) return m;
    }
  }
  let emptyTarget = -1;
  for (let i = 0; i < 7; i++) {
    if (from.type === "tableau" && from.index === i) continue;
    const m: Move = { from, to: { type: "tableau", index: i }, count };
    if (!isLegalMove(g, m)) continue;
    if (g.tableau[i].length > 0) return m;
    if (emptyTarget < 0) emptyTarget = i;
  }
  if (emptyTarget >= 0) {
    // moving a whole king-led column onto another empty column is pointless
    if (from.type === "tableau" && src.length === count) return null;
    return { from, to: { type: "tableau", index: emptyTarget }, count };
  }
  return null;
}

export function findFoundationMove(g: Game): Move | null {
  if (g.waste.length) {
    const c = g.waste[g.waste.length - 1];
    const s = foundationSlotFor(g, c);
    if (s >= 0) return { from: { type: "waste", index: 0 }, to: { type: "foundation", index: s }, count: 1 };
  }
  for (let i = 0; i < 7; i++) {
    const col = g.tableau[i];
    if (!col.length) continue;
    const c = col[col.length - 1];
    if (!c.up) continue;
    const s = foundationSlotFor(g, c);
    if (s >= 0) return { from: { type: "tableau", index: i }, to: { type: "foundation", index: s }, count: 1 };
  }
  return null;
}

export function findHint(g: Game): Hint | null {
  let best: { score: number; hint: Hint } | null = null;
  const add = (score: number, hint: Hint) => {
    if (!best || score > best.score) best = { score, hint };
  };
  const T = (i: number): PileRef => ({ type: "tableau", index: i });

  if (g.waste.length) {
    const from: PileRef = { type: "waste", index: 0 };
    const c = g.waste[g.waste.length - 1];
    const fs = foundationSlotFor(g, c);
    if (fs >= 0) add(100, { from, count: 1, to: { type: "foundation", index: fs } });
    for (let i = 0; i < 7; i++) {
      if (canPlaceOnTableau(c, g.tableau[i])) add(g.tableau[i].length ? 60 : 62, { from, count: 1, to: T(i) });
    }
  }

  for (let c = 0; c < 7; c++) {
    const col = g.tableau[c];
    const firstUp = col.findIndex((x) => x.up);
    if (firstUp < 0) continue;
    const top = col[col.length - 1];
    const fs = foundationSlotFor(g, top);
    if (fs >= 0) {
      add(95 + (col.length - 1 === firstUp && firstUp > 0 ? 3 : 0), {
        from: T(c),
        count: 1,
        to: { type: "foundation", index: fs },
      });
    }
    for (let k = firstUp; k < col.length; k++) {
      const card = col[k];
      for (let i = 0; i < 7; i++) {
        if (i === c || !canPlaceOnTableau(card, g.tableau[i])) continue;
        if (k === 0 && g.tableau[i].length === 0) continue; // pointless king shuffle
        const count = col.length - k;
        const flips = k === firstUp && firstUp > 0;
        if (flips) {
          add(80 + firstUp, { from: T(c), count, to: T(i) });
        } else if (k === 0) {
          add(50, { from: T(c), count, to: T(i) }); // frees up a column
        } else {
          const exposed = col[k - 1];
          if (exposed.up && foundationSlotFor(g, exposed) >= 0) add(75, { from: T(c), count, to: T(i) });
        }
      }
    }
  }

  if (best) return (best as { score: number; hint: Hint }).hint;
  if (g.stock.length > 0 || g.waste.length > 0) {
    return { from: { type: "stock", index: 0 }, count: 0, to: null };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Auto-finish planner                                                 */
/* ------------------------------------------------------------------ */

export type AutoStep = { kind: "move"; move: Move } | { kind: "draw" };

export function planAutoFinish(g: Game): AutoStep[] | null {
  const steps: AutoStep[] = [];
  let cur = g;
  let idle = 0;
  for (let iter = 0; iter < 600 && !isWon(cur); iter++) {
    const m = findFoundationMove(cur);
    if (m) {
      const r = applyMove(cur, m);
      if (!r) return null;
      cur = r.game;
      steps.push({ kind: "move", move: m });
      idle = 0;
      continue;
    }
    if (cur.stock.length > 0 || cur.waste.length > 0) {
      idle++;
      if (idle > cur.stock.length + cur.waste.length + 6) return null;
      const d = drawFromStock(cur, true);
      if (!d) return null;
      cur = d.game;
      steps.push({ kind: "draw" });
      continue;
    }
    return null;
  }
  return isWon(cur) ? steps : null;
}

/* ------------------------------------------------------------------ */
/* Deadlock detection                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns true if *any* progress (a card reaching a foundation, or a face-down
 * tableau card being revealed) is still reachable via legal moves and stock
 * cycling. If the search space is exhausted without progress the game is stuck.
 * Conservative: when the search budget is exceeded we assume progress exists.
 */
export function canProgress(g: Game, maxStates = 14000, budgetMs = 70): boolean {
  const fTop = [0, 0, 0, 0];
  for (const f of g.foundations) {
    if (f.length) {
      const t = f[f.length - 1];
      fTop[t.suit] = t.rank;
    }
  }
  const down = g.tableau.map((col) => col.reduce((n, c) => n + (c.up ? 0 : 1), 0));
  const drawN = g.drawCount;

  interface S {
    tab: number[][];
    stock: number[];
    waste: number[];
  }
  const start: S = {
    tab: g.tableau.map((c) => c.map((x) => x.id)),
    stock: g.stock.map((x) => x.id),
    waste: g.waste.map((x) => x.id),
  };
  const key = (s: S) =>
    s.tab.map((c) => c.join(",")).join("|") + "#" + s.stock.join(",") + "#" + s.waste.join(",");
  const suitOf = (id: number) => Math.floor(id / 13);
  const rankOf = (id: number) => (id % 13) + 1;
  const red = (id: number) => {
    const s = suitOf(id);
    return s === 1 || s === 2;
  };
  const fits = (id: number, col: number[]) => {
    if (col.length === 0) return rankOf(id) === 13;
    const t = col[col.length - 1];
    return red(t) !== red(id) && rankOf(t) === rankOf(id) + 1;
  };

  const seen = new Set<string>([key(start)]);
  const queue: S[] = [start];
  let qi = 0;
  const t0 = performance.now();

  while (qi < queue.length) {
    if (queue.length > maxStates || performance.now() - t0 > budgetMs) return true;
    const s = queue[qi++];
    const push = (n: S) => {
      const k = key(n);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    };

    if (s.waste.length) {
      const w = s.waste[s.waste.length - 1];
      if (rankOf(w) === fTop[suitOf(w)] + 1) return true;
      for (let d = 0; d < 7; d++) {
        if (fits(w, s.tab[d])) {
          const tab = s.tab.slice();
          tab[d] = [...tab[d], w];
          push({ tab, stock: s.stock, waste: s.waste.slice(0, -1) });
        }
      }
    }

    for (let c = 0; c < 7; c++) {
      const col = s.tab[c];
      const dn = down[c];
      if (col.length <= dn) continue;
      const top = col[col.length - 1];
      if (rankOf(top) === fTop[suitOf(top)] + 1) return true;
      for (let k = dn; k < col.length; k++) {
        const head = col[k];
        for (let d = 0; d < 7; d++) {
          if (d === c || !fits(head, s.tab[d])) continue;
          if (k === dn && dn > 0) return true; // reveals a face-down card
          if (k === 0 && s.tab[d].length === 0) continue; // pointless
          const tab = s.tab.slice();
          tab[c] = col.slice(0, k);
          tab[d] = [...tab[d], ...col.slice(k)];
          push({ tab, stock: s.stock, waste: s.waste });
        }
      }
    }

    if (s.stock.length) {
      const n = Math.min(drawN, s.stock.length);
      const st = s.stock.slice(0, s.stock.length - n);
      const taken = s.stock.slice(s.stock.length - n).reverse();
      push({ tab: s.tab, stock: st, waste: [...s.waste, ...taken] });
    } else if (s.waste.length) {
      push({ tab: s.tab, stock: s.waste.slice().reverse(), waste: [] });
    }
  }
  return false;
}

export function isStuck(g: Game): boolean {
  if (isWon(g)) return false;
  return !canProgress(g);
}

export function timeBonus(seconds: number): number {
  if (seconds <= 30) return 0;
  return Math.floor(700000 / seconds);
}
