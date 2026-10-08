import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import type { Card, Cursor, Game, Hint, Move, PileRef, Selection } from "../game/types";
import { pileKey } from "../game/types";
import { getPile, isLegalMove, isSource } from "../game/rules";
import { computeLayout, computePositions, dealOrder, dropRect, runRect, slotRect, topCardRect } from "../game/layout";
import type { Layout, Pos, Rect } from "../game/layout";
import { CardView, cardTransform } from "./CardView";
import { boardApi } from "../fx/effects";
import * as P from "../fx/particles";
import { sfx } from "../fx/audio";
import { reducedMotion, smoothing } from "../fx/motion";

export interface BoardProps {
  game: Game;
  stage: 0 | 1 | 2 | 3;
  selected: Selection | null;
  hint: Hint | null;
  cursor: Cursor | null;
  showCursor: boolean;
  paused: boolean;
  interactive: boolean;
  onDraw: () => void;
  onTapCard: (p: PileRef, idx: number) => void;
  onTapPile: (p: PileRef) => void;
  onMove: (m: Move) => boolean;
  onInput: () => void;
  onDragStart: () => void;
}

interface Meta {
  card: Card;
  pile: PileRef;
  idx: number;
}

interface DragState {
  pointerId: number;
  pile: PileRef;
  idx: number;
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  lastCx: number;
  active: boolean;
  canDrag: boolean;
  ids: number[];
  els: { id: number; el: HTMLElement }[];
  count: number;
  targets: PileRef[];
  hoverKey: string | null;
  vel: number;
  tilt: number;
  raf: number;
  originX: number;
  originY: number;
  lastFrame: number;
  lastSpark: number;
  game: Game;
  layout: Layout;
}

const ALL_PILES: PileRef[] = [
  { type: "stock", index: 0 },
  { type: "waste", index: 0 },
  ...[0, 1, 2, 3].map((i): PileRef => ({ type: "foundation", index: i })),
  ...[0, 1, 2, 3, 4, 5, 6].map((i): PileRef => ({ type: "tableau", index: i })),
];

function legalTargets(g: Game, from: PileRef, count: number): PileRef[] {
  const out: PileRef[] = [];
  for (let i = 0; i < 4; i++) {
    const to: PileRef = { type: "foundation", index: i };
    if (isLegalMove(g, { from, to, count })) out.push(to);
  }
  for (let i = 0; i < 7; i++) {
    const to: PileRef = { type: "tableau", index: i };
    if (isLegalMove(g, { from, to, count })) out.push(to);
  }
  return out;
}

function pickTarget(
  g: Game,
  l: Layout,
  pos: Pos[],
  targets: PileRef[],
  card: Rect,
  px: number,
  py: number,
): PileRef | null {
  let best: PileRef | null = null;
  let bestScore = 0;
  for (const t of targets) {
    const r = dropRect(g, l, pos, t);
    const ox = Math.min(card.x + card.w, r.x + r.w) - Math.max(card.x, r.x);
    const oy = Math.min(card.y + card.h, r.y + r.h) - Math.max(card.y, r.y);
    let s = ox > 0 && oy > 0 ? ox * oy : 0;
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) s += l.cw * l.ch * 0.6;
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return bestScore > l.cw * l.ch * 0.12 ? best : null;
}

export const Board = memo(function Board(props: BoardProps) {
  const { game, stage, selected, hint, cursor, showCursor, paused } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ W: 0, H: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      setSize((s) => (s.W === W && s.H === H ? s : { W, H }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ready = size.W > 0 && size.H > 0;
  const layout = useMemo(() => computeLayout(Math.max(size.W, 1), Math.max(size.H, 1)), [size]);
  const positions = useMemo(() => computePositions(game, layout, stage), [game, layout, stage]);

  const meta = useMemo(() => {
    const arr: Meta[] = new Array(52);
    const stockRef: PileRef = { type: "stock", index: 0 };
    const wasteRef: PileRef = { type: "waste", index: 0 };
    game.stock.forEach((card, idx) => (arr[card.id] = { card, pile: stockRef, idx }));
    game.waste.forEach((card, idx) => (arr[card.id] = { card, pile: wasteRef, idx }));
    game.foundations.forEach((f, fi) => {
      const ref: PileRef = { type: "foundation", index: fi };
      f.forEach((card, idx) => (arr[card.id] = { card, pile: ref, idx }));
    });
    game.tableau.forEach((t, ti) => {
      const ref: PileRef = { type: "tableau", index: ti };
      t.forEach((card, idx) => (arr[card.id] = { card, pile: ref, idx }));
    });
    return arr;
  }, [game]);

  const latest = useRef({ game, layout, positions, meta, props });
  latest.current = { game, layout, positions, meta, props };

  // remember which cards were face-up last commit so fresh reveals can flip as the mover lands
  const prevUp = useRef<boolean[]>([]);
  useLayoutEffect(() => {
    for (let id = 0; id < 52; id++) {
      const m = meta[id];
      if (m) prevUp.current[id] = m.card.up && stage >= 2;
    }
  });

  /* ---------------- flying cards (z-order while in transit) ---------------- */
  const [fly, setFly] = useState<ReadonlySet<number>>(() => new Set<number>());
  const prevPile = useRef<string[]>([]);
  const flyTimer = useRef(0);
  const addFly = useCallback((ids: number[]) => {
    setFly((prev) => {
      const n = new Set(prev);
      ids.forEach((i) => n.add(i));
      return n;
    });
    window.clearTimeout(flyTimer.current);
    flyTimer.current = window.setTimeout(() => setFly(new Set<number>()), 600);
  }, []);
  useLayoutEffect(() => {
    const changed: number[] = [];
    for (let id = 0; id < 52; id++) {
      const m = meta[id];
      if (!m) continue;
      const k = pileKey(m.pile);
      const pk = prevPile.current[id];
      if (pk !== undefined && pk !== k) changed.push(id);
      prevPile.current[id] = k;
    }
    if (changed.length) addFly(changed);
  }, [meta, addFly]);
  useEffect(() => () => window.clearTimeout(flyTimer.current), []);

  /* ---------------- drag state ---------------- */
  const dragRef = useRef<DragState | null>(null);
  const [dragIds, setDragIds] = useState<ReadonlySet<number> | null>(null);
  const [dragTargets, setDragTargets] = useState<PileRef[]>([]);
  const [hover, setHover] = useState<string | null>(null);

  const applyDrag = useCallback((d: DragState) => {
    const L = latest.current;
    const { cw, ch } = L.layout;
    const dx = d.cx - d.sx;
    const dy = d.cy - d.sy;
    const th = (d.tilt * Math.PI) / 180;
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    const px = d.sx - d.originX + dx;
    const py = d.sy - d.originY + dy;
    for (const { id, el } of d.els) {
      const base = L.positions[id];
      if (!base) continue;
      const ccx = base.x + cw / 2 + dx;
      const ccy = base.y + ch / 2 + dy;
      const rx = ccx - px;
      const ry = ccy - py;
      const nx = px + rx * cos - ry * sin;
      const ny = py + rx * sin + ry * cos;
      el.style.transform = `translate3d(${(nx - cw / 2).toFixed(2)}px, ${(ny - ch / 2).toFixed(2)}px, 0) rotate(${d.tilt.toFixed(2)}deg) scale(1.045)`;
    }
  }, []);

  const currentTarget = useCallback((d: DragState): PileRef | null => {
    const L = latest.current;
    const first = L.positions[d.ids[0]];
    if (!first) return null;
    const dx = d.cx - d.sx;
    const dy = d.cy - d.sy;
    const rect: Rect = { x: first.x + dx, y: first.y + dy, w: L.layout.cw, h: L.layout.ch };
    return pickTarget(L.game, L.layout, L.positions, d.targets, rect, d.sx - d.originX + dx, d.sy - d.originY + dy);
  }, []);

  const loop = useCallback((now: number) => {
    const d = dragRef.current;
    if (!d || !d.active) return;
    const dt = Math.max(0.001, Math.min(0.05, (now - d.lastFrame) / 1000));
    d.lastFrame = now;
    const mvx = (d.cx - d.lastCx) / dt;
    d.lastCx = d.cx;
    const ease = smoothing(dt);
    d.vel += (mvx - d.vel) * ease;
    const tt = reducedMotion() ? 0 : Math.max(-7, Math.min(7, d.vel * 0.012));
    d.tilt += (tt - d.tilt) * ease;
    applyDrag(d);

    const t = currentTarget(d);
    const key = t ? pileKey(t) : null;
    if (key !== d.hoverKey) {
      d.hoverKey = key;
      setHover(key);
    }
    if (now - d.lastSpark >= 50 && Math.abs(d.vel) > 160) {
      d.lastSpark = now;
      const L = latest.current;
      const first = L.positions[d.ids[0]];
      if (first) {
        const px = d.originX + first.x + (d.cx - d.sx) + Math.random() * L.layout.cw;
        const py = d.originY + first.y + (d.cy - d.sy) + Math.random() * L.layout.ch;
        P.twinkle(px, py);
      }
    }
    d.raf = requestAnimationFrame(loop);
  }, [applyDrag, currentTarget]);

  const beginDrag = useCallback(
    (d: DragState) => {
      const L = latest.current;
      const wrap = wrapRef.current;
      if (!wrap) return;
      const cards = getPile(L.game, d.pile);
      const ids = cards.slice(d.idx).map((c) => c.id);
      d.ids = ids;
      d.count = ids.length;
      d.active = true;
      d.lastFrame = performance.now();
      d.targets = legalTargets(L.game, d.pile, d.count);
      d.els = [];
      for (const id of ids) {
        const el = wrap.querySelector<HTMLElement>(`.card-pos[data-id="${id}"]`);
        if (el) d.els.push({ id, el });
      }
      flushSync(() => {
        setDragIds(new Set(ids));
        setDragTargets(d.targets);
        setHover(null);
      });
      L.props.onDragStart();
      sfx.pick();
      d.raf = requestAnimationFrame(loop);
    },
    [loop],
  );

  const onWinMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      d.cx = e.clientX;
      d.cy = e.clientY;
      if (!d.active && d.canDrag) {
        const dx = d.cx - d.sx;
        const dy = d.cy - d.sy;
        if (dx * dx + dy * dy > 36) beginDrag(d);
      }
    },
    [beginDrag],
  );

  // One stable "up" listener that forwards to the latest finish handler.
  const finishRef = useRef<(e: PointerEvent) => void>(() => {});
  const stableUp = useCallback((e: PointerEvent) => finishRef.current(e), []);

  const finishDrag = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", stableUp);
      window.removeEventListener("pointercancel", stableUp);
      dragRef.current = null;
      cancelAnimationFrame(d.raf);
      const L = latest.current;
      const cancelled = e.type === "pointercancel" || !L.props.interactive ||
        d.game.tableau !== L.game.tableau || d.game.stock !== L.game.stock ||
        d.game.waste !== L.game.waste || d.game.foundations !== L.game.foundations || d.layout !== L.layout;
      if (!d.active) {
        if (!cancelled) L.props.onTapCard(d.pile, d.idx);
        return;
      }
      if (!cancelled) {
        d.cx = e.clientX;
        d.cy = e.clientY;
      }
      const target = cancelled ? null : currentTarget(d);
      flushSync(() => {
        setDragIds(null);
        setDragTargets([]);
        setHover(null);
      });
      let ok = false;
      if (target) ok = L.props.onMove({ from: d.pile, to: target, count: d.count });
      if (!ok) {
        // snap the stack back home (React's vnode transform is unchanged, so restore the DOM by hand)
        for (const { id, el } of d.els) {
          const b = L.positions[id];
          if (b) el.style.transform = cardTransform(b.x, b.y, b.rot);
        }
        addFly(d.ids);
        sfx.drop();
      }
    },
    [addFly, currentTarget, onWinMove, stableUp],
  );
  finishRef.current = finishDrag;

  const onCardDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, id: number) => {
      const L = latest.current;
      if (!L.props.interactive) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (dragRef.current) return;
      e.preventDefault();
      L.props.onInput();
      const m = L.meta[id];
      if (!m) return;
      if (m.pile.type === "stock") {
        L.props.onDraw();
        return;
      }
      const canDrag = isSource(L.game, m.pile, m.idx);
      const wrap = wrapRef.current;
      if (!wrap) return;
      const b = wrap.getBoundingClientRect();
      dragRef.current = {
        pointerId: e.pointerId,
        pile: m.pile,
        idx: m.idx,
        sx: e.clientX,
        sy: e.clientY,
        cx: e.clientX,
        cy: e.clientY,
        lastCx: e.clientX,
        active: false,
        canDrag,
        ids: [],
        els: [],
        count: 0,
        targets: [],
        hoverKey: null,
        vel: 0,
        tilt: 0,
        raf: 0,
        originX: b.left,
        originY: b.top,
        lastFrame: performance.now(),
        lastSpark: 0,
        game: L.game,
        layout: L.layout,
      };
      window.addEventListener("pointermove", onWinMove);
      window.addEventListener("pointerup", stableUp);
      window.addEventListener("pointercancel", stableUp);
    },
    [onWinMove, stableUp],
  );

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", stableUp);
      window.removeEventListener("pointercancel", stableUp);
      const d = dragRef.current;
      if (d) cancelAnimationFrame(d.raf);
      dragRef.current = null;
    },
    [onWinMove, stableUp],
  );

  // Cancelling a gesture must never commit a move against a changed board.
  const cancelDrag = useCallback(() => {
    const d = dragRef.current;
    if (d) finishRef.current(new PointerEvent("pointercancel", { pointerId: d.pointerId }));
  }, []);
  useEffect(() => {
    cancelDrag();
  }, [game.tableau, game.stock, game.waste, game.foundations, layout, props.interactive, cancelDrag]);
  useEffect(() => {
    const onHidden = () => { if (document.hidden) cancelDrag(); };
    window.addEventListener("blur", cancelDrag);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("blur", cancelDrag);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [cancelDrag]);

  /* ---------------- zones (tap targets for piles) ---------------- */
  const onZoneDown = useCallback((e: ReactPointerEvent<HTMLDivElement>, p: PileRef) => {
    const L = latest.current;
    if (!L.props.interactive) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    L.props.onInput();
    if (p.type === "stock") L.props.onDraw();
    else L.props.onTapPile(p);
  }, []);

  /* ---------------- registry for FX ---------------- */
  useEffect(() => {
    const rectFor = (p: PileRef): Rect | null => {
      const el = wrapRef.current;
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const L = latest.current;
      const g = boardApi.overrideGame ?? L.game;
      const pos = boardApi.overrideGame ? computePositions(g, L.layout, 3) : L.positions;
      const r = topCardRect(g, L.layout, pos, p);
      return { x: b.left + r.x, y: b.top + r.y, w: r.w, h: r.h };
    };
    boardApi.getPileRect = rectFor;
    boardApi.getFoundationRects = () => [0, 1, 2, 3].map((i) => rectFor({ type: "foundation", index: i }) as Rect);
    boardApi.getCardSize = () => ({ cw: latest.current.layout.cw, ch: latest.current.layout.ch });
    boardApi.hideCard = (id: number) => {
      const el = wrapRef.current?.querySelector<HTMLElement>(`.card-pos[data-id="${id}"]`);
      if (el) el.style.visibility = "hidden";
    };
    boardApi.showAllCards = () => {
      wrapRef.current?.querySelectorAll<HTMLElement>(".card-pos").forEach((el) => (el.style.visibility = ""));
    };
  }, []);

  // reveal any cards hidden by the win cascade when a new deal begins
  useEffect(() => {
    if (stage === 0) boardApi.showAllCards();
  }, [stage]);

  /* ---------------- derived render data ---------------- */
  const selectedIds = useMemo(() => {
    const s = new Set<number>();
    if (selected) {
      const cards = getPile(game, selected.from);
      for (let i = Math.max(0, cards.length - selected.count); i < cards.length; i++) s.add(cards[i].id);
    }
    return s;
  }, [game, selected]);

  const hintIds = useMemo(() => {
    const s = new Set<number>();
    if (hint && hint.from.type !== "stock") {
      const cards = getPile(game, hint.from);
      for (let i = Math.max(0, cards.length - hint.count); i < cards.length; i++) s.add(cards[i].id);
    }
    return s;
  }, [game, hint]);

  const selTargets = useMemo(
    () => (selected && !dragIds ? legalTargets(game, selected.from, selected.count) : []),
    [game, selected, dragIds],
  );

  const rings = useMemo(() => {
    const out: { key: string; r: Rect; hot: boolean; kind: "target" | "hint" }[] = [];
    if (!ready) return out;
    const targets = dragIds ? dragTargets : selTargets;
    for (const t of targets) {
      const r = topCardRect(game, layout, positions, t);
      out.push({ key: `t-${pileKey(t)}`, r, hot: hover === pileKey(t), kind: "target" });
    }
    if (hint && !dragIds) {
      if (hint.to) {
        out.push({ key: "hint-to", r: topCardRect(game, layout, positions, hint.to), hot: true, kind: "hint" });
      } else {
        out.push({ key: "hint-stock", r: slotRect(layout, { type: "stock", index: 0 }), hot: true, kind: "hint" });
      }
    }
    return out;
  }, [ready, dragIds, dragTargets, selTargets, game, layout, positions, hover, hint]);

  const cursorRect = useMemo(() => {
    if (!ready || !cursor || !showCursor) return null;
    const p = cursor.pile;
    const cards = getPile(game, p);
    if (!cards.length) return slotRect(layout, p);
    if (p.type === "tableau") {
      const idx = Math.max(0, cards.length - 1 - cursor.depth);
      return runRect(game, layout, positions, p, idx);
    }
    return topCardRect(game, layout, positions, p);
  }, [ready, cursor, showCursor, game, layout, positions]);

  const dealing = stage < 3;
  const recycleHint = game.stock.length === 0 && game.waste.length > 0;

  return (
    <div
      ref={wrapRef}
      className="board-root relative h-full w-full select-none overflow-hidden"
      data-paused={paused ? 1 : 0}
      data-dragging={dragIds ? 1 : 0}
      role="application"
      aria-label="Solitaire board"
    >
      {ready && (
        <>
          {/* slots */}
          {ALL_PILES.map((p) => {
            const r = slotRect(layout, p);
            return (
              <div
                key={pileKey(p)}
                className="slot"
                data-hot={hover === pileKey(p) ? 1 : 0}
                style={{
                  width: r.w,
                  height: r.h,
                  borderRadius: layout.radius,
                  transform: `translate3d(${r.x}px, ${r.y}px, 0)`,
                  fontSize: layout.cw * 0.42,
                }}
              >
                {p.type === "foundation" && <span style={{ opacity: 0.8 }}>A</span>}
                {p.type === "tableau" && <span style={{ opacity: 0.6 }}>K</span>}
                {p.type === "stock" && (
                  <span
                    className={recycleHint ? "recycle-pulse" : ""}
                    style={{ opacity: recycleHint ? 1 : 0.5, fontSize: layout.cw * 0.5 }}
                  >
                    ↻
                  </span>
                )}
              </div>
            );
          })}

          {/* tap zones */}
          {ALL_PILES.map((p) => {
            const r = slotRect(layout, p);
            const h = p.type === "tableau" ? Math.max(r.h, layout.H - r.y) : r.h;
            return (
              <div
                key={`z-${pileKey(p)}`}
                className="absolute"
                style={{
                  left: r.x - layout.gap / 2,
                  top: r.y,
                  width: r.w + layout.gap,
                  height: h,
                  zIndex: 0,
                  touchAction: "none",
                }}
                onPointerDown={(e) => onZoneDown(e, p)}
              />
            );
          })}

          {/* cards */}
          {meta.map((m) => {
            if (!m) return null;
            const id = m.card.id;
            const pos = positions[id];
            if (!pos) return null;
            const isDrag = dragIds ? dragIds.has(id) : false;
            let dur = 300;
            let delay = 0;
            let flipDelay = 0;
            let z = pos.z;
            if (stage === 0) {
              dur = 620;
            } else if (stage === 1) {
              dur = 520;
              delay = ((id * 7) % 52) * 4;
            } else if (stage === 2) {
              dur = 480;
              // dealt cards must fly *over* the remaining stock pile
              z = pos.z + (m.pile.type === "stock" ? 0 : 1500);
              if (m.pile.type === "tableau") {
                const order = dealOrder(m.pile.index, m.idx);
                delay = order * 38;
                flipDelay = delay + 380;
              }
            }
            if (fly.has(id) && stage >= 3) z += 1000;
            if (isDrag) z = 5000 + m.idx;
            const up = m.card.up && stage >= 2;
            if (stage >= 3 && up && prevUp.current[id] === false) flipDelay = 230;
            const grab = !dealing && props.interactive && m.pile.type !== "stock" && isSource(game, m.pile, m.idx);
            return (
              <CardView
                key={id}
                id={id}
                suit={m.card.suit}
                rank={m.card.rank}
                up={up}
                x={pos.x}
                y={pos.y}
                z={z}
                rot={pos.rot}
                cw={layout.cw}
                ch={layout.ch}
                radius={layout.radius}
                dur={dur}
                delay={delay}
                flipDelay={flipDelay}
                dragging={isDrag}
                selected={selectedIds.has(id)}
                hint={hintIds.has(id)}
                fly={fly.has(id)}
                grab={grab}
                onDown={onCardDown}
              />
            );
          })}

          {/* target / hint rings */}
          {rings.map((ring) => (
            <div
              key={ring.key}
              className={ring.kind === "hint" ? "ring ring-hint" : "ring"}
              data-hot={ring.hot ? 1 : 0}
              style={{
                width: ring.r.w + 8,
                height: ring.r.h + 8,
                borderRadius: layout.radius + 4,
                transform: `translate3d(${ring.r.x - 4}px, ${ring.r.y - 4}px, 0)`,
                zIndex: 900,
              }}
            />
          ))}

          {/* keyboard cursor */}
          {cursorRect && (
            <div
              className="ring ring-cursor"
              style={{
                width: cursorRect.w + 10,
                height: cursorRect.h + 10,
                borderRadius: layout.radius + 5,
                transform: `translate3d(${cursorRect.x - 5}px, ${cursorRect.y - 5}px, 0)`,
                zIndex: 950,
              }}
            />
          )}
        </>
      )}
    </div>
  );
});
