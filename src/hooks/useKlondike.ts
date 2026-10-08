import { useEffect, useMemo, useRef, useState } from "react";
import type { Game, Hint, Move, PileRef, Selection } from "../game/types";
import {
  applyMove,
  deal,
  drawFromStock,
  faceDownCount,
  findAutoMove,
  findHint,
  getPile,
  isLegalMove,
  isSource,
  canProgress,
  isWon,
  planAutoFinish,
  randomSeed,
  timeBonus,
} from "../game/rules";
import type { MoveResult } from "../game/rules";
import { addScore, loadScores, loadStats, saveStats } from "../game/storage";
import type { ScoreEntry } from "../game/storage";
import { boardApi, fb } from "../fx/effects";
import { sfx } from "../fx/audio";
import { reducedMotion } from "../fx/motion";

export type Phase = "menu" | "playing" | "paused" | "won" | "stuck";
export type ToastTone = "info" | "warn" | "good";

export interface StartOpts {
  seed?: number;
  draw: 1 | 3;
  daily?: boolean;
  fromMenu?: boolean;
}

interface Pending {
  won: boolean;
  base: number;
  bonus: number;
  score: number;
  seconds: number;
  moves: number;
  draw: 1 | 3;
  daily: boolean;
  foundation: number;
}

export interface GameResult extends Pending {
  rank: number;
  entryId: string;
  scores: ScoreEntry[];
  saved: boolean;
}

interface HistEntry {
  prev: Game;
  delta: number;
}

type Stage = 0 | 1 | 2 | 3;

export function useKlondike(onToast: (msg: string, tone?: ToastTone) => void, getName: () => string) {
  const [game, setGame] = useState<Game>(() => deal(randomSeed(), 1));
  const [phase, setPhaseState] = useState<Phase>("menu");
  const [stage, setStageState] = useState<Stage>(3);
  const [seconds, setSeconds] = useState(0);
  const [selected, setSelectedState] = useState<Selection | null>(null);
  const [hint, setHintState] = useState<Hint | null>(null);
  const [canAuto, setCanAuto] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [histLen, setHistLen] = useState(0);
  const [combo, setCombo] = useState(0);

  const gameRef = useRef(game);
  const phaseRef = useRef<Phase>("menu");
  const stageRef = useRef<Stage>(3);
  const msRef = useRef(0);
  const selRef = useRef<Selection | null>(null);
  const hintRef = useRef<Hint | null>(null);
  const histRef = useRef<HistEntry[]>([]);
  const autoActive = useRef(false);
  const autoToken = useRef(0);
  const metaRef = useRef({ daily: false });
  const comboRef = useRef({ n: 0, t: 0 });
  const timers = useRef(new Set<number>());
  const stuckTimer = useRef(0);
  const hintTimer = useRef(0);
  const idleTimer = useRef(0);
  const lastTap = useRef({ key: "", t: 0 });
  const progressWorker = useRef<Worker | null>(null);
  const progressRequest = useRef(0);
  const pendingRef = useRef<Pending | null>(null);
  const toastRef = useRef(onToast);
  toastRef.current = onToast;
  const nameRef = useRef(getName);
  nameRef.current = getName;

  const ctl = useMemo(() => {
    const toast = (m: string, t: ToastTone = "info") => toastRef.current(m, t);
    const setPhase = (p: Phase) => {
      phaseRef.current = p;
      setPhaseState(p);
    };
    const setStage = (s: Stage) => {
      stageRef.current = s;
      setStageState(s);
    };
    const setSelected = (s: Selection | null) => {
      selRef.current = s;
      setSelectedState(s);
    };
    const clearHint = () => {
      window.clearTimeout(hintTimer.current);
      if (hintRef.current) {
        hintRef.current = null;
        setHintState(null);
      }
    };
    const canAct = () => phaseRef.current === "playing" && stageRef.current === 3 && !autoActive.current;
    const at = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        timers.current.delete(id);
        fn();
      }, ms);
      timers.current.add(id);
    };

    function resetIdle() {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        if (canAct() && !selRef.current && !hintRef.current) showHint(true);
      }, 15000);
    }

    function persist(p: Pending): { entryId: string; rank: number; scores: ScoreEntry[] } {
      let entryId = "";
      let rank = -1;
      let scores = loadScores();
      if (p.won || p.score > 0) {
        const r = addScore({
          name: nameRef.current(),
          score: p.score,
          seconds: p.seconds,
          moves: p.moves,
          date: Date.now(),
          draw: p.draw,
          won: p.won,
          daily: p.daily,
        });
        entryId = r.entry.id;
        rank = r.rank;
        scores = r.list;
      }
      const st = loadStats();
      if (p.won) {
        const streak = st.streak + 1;
        saveStats({ played: st.played + 1, won: st.won + 1, streak, bestStreak: Math.max(st.bestStreak, streak) });
      } else {
        saveStats({ ...st, played: st.played + 1, streak: 0 });
      }
      return { entryId, rank, scores };
    }

    function finalizePending() {
      const p = pendingRef.current;
      if (p) {
        pendingRef.current = null;
        persist(p);
      }
    }

    function finish(won: boolean) {
      if (phaseRef.current !== "playing") return;
      window.clearTimeout(stuckTimer.current);
      window.clearTimeout(idleTimer.current);
      clearHint();
      autoToken.current++;
      autoActive.current = false;
      setAutoRunning(false);
      setSelected(null);
      const g = gameRef.current;
      const secs = Math.floor(msRef.current / 1000);
      const bonus = won ? timeBonus(secs) : 0;
      const final = g.score + bonus;
      const foundation = g.foundations.reduce((n, f) => n + f.length, 0);
      const pending: Pending = {
        won,
        base: g.score,
        bonus,
        score: final,
        seconds: secs,
        moves: g.moves,
        draw: g.drawCount,
        daily: metaRef.current.daily,
        foundation,
      };
      let res: GameResult;
      if (won) {
        const s = persist(pending);
        res = { ...pending, ...s, saved: true };
        pendingRef.current = null;
      } else {
        const scores = loadScores();
        const better = scores.filter((e) => e.score > pending.score).length;
        res = {
          ...pending,
          entryId: "",
          rank: pending.score > 0 && better < 10 ? better + 1 : -1,
          scores,
          saved: false,
        };
        pendingRef.current = pending;
      }
      const ng = { ...g, score: final };
      gameRef.current = ng;
      setGame(ng);
      setResult(res);
      setCanAuto(false);
      setPhase(won ? "won" : "stuck");
      if (won) fb.win();
      else fb.stuck();
    }

    function checkStuck(g: Game) {
      const worker = progressWorker.current;
      const id = ++progressRequest.current;
      if (worker) {
        worker.onmessage = (event: MessageEvent<{ id: number; stuck: boolean }>) => {
          if (event.data.id === id && gameRef.current === g && canAct() && event.data.stuck) finish(false);
        };
        worker.postMessage({ id, game: g });
      } else if (canAct() && !canProgress(g, 14000, 3)) {
        // A small conservative budget keeps unsupported browsers responsive.
        finish(false);
      }
    }

    function afterChange(g: Game) {
      if (isWon(g)) {
        finish(true);
        return;
      }
      if (!autoActive.current) setCanAuto(faceDownCount(g) === 0 && planAutoFinish(g) !== null);
      window.clearTimeout(stuckTimer.current);
      stuckTimer.current = window.setTimeout(() => {
        if (phaseRef.current !== "playing") return;
        const cur = gameRef.current;
        if (cur.moves === g.moves && !autoActive.current) checkStuck(cur);
      }, 1100);
      resetIdle();
    }

    function commit(prev: Game, next: Game, delta: number) {
      histRef.current.push({ prev, delta });
      if (histRef.current.length > 400) histRef.current.shift();
      gameRef.current = next;
      setGame(next);
      setHistLen(histRef.current.length);
      setSelected(null);
      clearHint();
      afterChange(next);
    }

    function emitMoveFx(m: Move, r: MoveResult, g: Game) {
      boardApi.overrideGame = g;
      try {
        if (m.to.type === "foundation") {
          const now = performance.now();
          const c = comboRef.current;
          c.n = now - c.t < 4500 ? c.n + 1 : 1;
          c.t = now;
          setCombo(c.n);
          const pile = getPile(g, m.to);
          const card = pile[pile.length - 1];
          fb.foundation(m.to, card.rank, c.n, card.rank === 13, r.delta);
        } else {
          fb.place(m.to, r.delta, m.count);
        }
      } finally {
        boardApi.overrideGame = null;
      }
      if (r.flipped !== null) at(200, () => fb.flip());
    }

    function startGame(o: StartOpts) {
      finalizePending();
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
      window.clearTimeout(stuckTimer.current);
      window.clearTimeout(idleTimer.current);
      autoToken.current++;
      autoActive.current = false;
      setAutoRunning(false);
      fb.stopWin();
      clearHint();

      const seed = o.seed ?? randomSeed();
      const g = deal(seed, o.draw);
      gameRef.current = g;
      setGame(g);
      histRef.current = [];
      setHistLen(0);
      msRef.current = 0;
      setSeconds(0);
      setSelected(null);
      setResult(null);
      setCanAuto(false);
      setCombo(0);
      comboRef.current = { n: 0, t: 0 };
      metaRef.current = { daily: !!o.daily };
      lastTap.current = { key: "", t: 0 };
      setPhase("playing");
      setStage(0);

      if (reducedMotion()) {
        setStage(3);
        afterChange(g);
        return;
      }

      const t0 = o.fromMenu ? 620 : 520;
      for (let i = 0; i < 9; i++) at(t0 + i * 34, () => sfx.flick());
      at(t0, () => setStage(1));
      const t1 = t0 + 780;
      at(t1, () => {
        setStage(2);
        for (let i = 0; i < 28; i++) {
          at(60 + i * 38, () => sfx.deal(i));
        }
      });
      at(t1 + 1750, () => {
        setStage(3);
        afterChange(gameRef.current);
        if (document.hidden) pause();
      });
    }

    function leave() {
      finalizePending();
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
      window.clearTimeout(stuckTimer.current);
      window.clearTimeout(idleTimer.current);
      autoToken.current++;
      autoActive.current = false;
      setAutoRunning(false);
      fb.stopWin();
      clearHint();
      setSelected(null);
      setResult(null);
      setStage(3);
      setPhase("menu");
    }

    function move(m: Move): boolean {
      if (!canAct()) return false;
      const g = gameRef.current;
      const r = applyMove(g, m);
      if (!r) {
        fb.invalid();
        return false;
      }
      commit(g, r.game, r.delta);
      emitMoveFx(m, r, r.game);
      return true;
    }

    function draw() {
      if (!canAct()) return;
      const g = gameRef.current;
      const r = drawFromStock(g);
      if (!r) {
        fb.invalid();
        toast("Nothing left to draw", "warn");
        return;
      }
      commit(g, r.game, r.delta);
      fb.draw(r.recycled, r.delta);
    }

    function autoMove(from: PileRef, count: number): boolean {
      if (!canAct()) return false;
      const m = findAutoMove(gameRef.current, from, count);
      if (!m) {
        fb.invalid();
        return false;
      }
      return move(m);
    }

    function select(from: PileRef, count: number) {
      setSelected({ from, count });
      clearHint();
      fb.select();
    }

    function tap(pile: PileRef, idx: number) {
      if (!canAct()) return;
      resetIdle();
      const g = gameRef.current;
      const cards = getPile(g, pile);
      const sourceOK = idx >= 0 && isSource(g, pile, idx);
      const now = performance.now();
      const key = `${pile.type}:${pile.index}:${idx}`;
      if (sourceOK && lastTap.current.key === key && now - lastTap.current.t < 380) {
        lastTap.current = { key: "", t: 0 };
        autoMove(pile, cards.length - idx);
        return;
      }
      lastTap.current = { key, t: now };
      const sel = selRef.current;
      if (sel) {
        if (sel.from.type === pile.type && sel.from.index === pile.index) {
          if (sourceOK && cards.length - idx !== sel.count) select(pile, cards.length - idx);
          else setSelected(null);
          return;
        }
        const m: Move = { from: sel.from, to: pile, count: sel.count };
        if (isLegalMove(g, m)) {
          move(m);
          return;
        }
        if (sourceOK) {
          select(pile, cards.length - idx);
          return;
        }
        fb.invalid();
        return;
      }
      if (sourceOK) select(pile, cards.length - idx);
    }

    function activate(pile: PileRef, depth: number) {
      if (!canAct()) return;
      if (pile.type === "stock") {
        draw();
        return;
      }
      const cards = getPile(gameRef.current, pile);
      if (!cards.length) {
        tap(pile, -1);
        return;
      }
      const idx = pile.type === "tableau" ? Math.max(0, cards.length - 1 - depth) : cards.length - 1;
      tap(pile, idx);
    }

    function undo(): boolean {
      const ph = phaseRef.current;
      if (!(ph === "playing" || ph === "stuck")) return false;
      if (ph === "playing" && !canAct()) return false;
      const e = histRef.current.pop();
      if (!e) {
        fb.invalid();
        toast("Nothing to undo", "warn");
        return false;
      }
      if (ph === "stuck") {
        pendingRef.current = null;
        setResult(null);
        setPhase("playing");
      }
      const cur = gameRef.current;
      const g: Game = { ...e.prev, score: Math.max(0, cur.score - e.delta) };
      gameRef.current = g;
      setGame(g);
      setHistLen(histRef.current.length);
      setSelected(null);
      clearHint();
      fb.undo();
      afterChange(g);
      return true;
    }

    function showHint(quiet = false) {
      if (!canAct()) return;
      const g = gameRef.current;
      const h = findHint(g);
      if (!h) {
        if (!quiet) toast("No moves left — try undo or a new deal", "warn");
        checkStuck(g);
        return;
      }
      window.clearTimeout(hintTimer.current);
      hintRef.current = h;
      setHintState(h);
      setSelected(null);
      fb.hint(h.to);
      hintTimer.current = window.setTimeout(() => {
        hintRef.current = null;
        setHintState(null);
      }, 3400);
      if (!quiet && h.to === null) toast("Try drawing from the stock", "info");
    }

    function pause() {
      if (phaseRef.current === "playing" && stageRef.current === 3) {
        autoToken.current++;
        autoActive.current = false;
        setAutoRunning(false);
        window.clearTimeout(stuckTimer.current);
        window.clearTimeout(idleTimer.current);
        clearHint();
        setPhase("paused");
        sfx.ui();
      }
    }

    function resume() {
      if (phaseRef.current === "paused") {
        setPhase("playing");
        afterChange(gameRef.current);
        sfx.ui();
      }
    }

    function autoFinish() {
      if (!canAct()) return;
      const plan = planAutoFinish(gameRef.current);
      if (!plan) {
        toast("Auto-finish isn't available yet", "warn");
        return;
      }
      const token = ++autoToken.current;
      autoActive.current = true;
      setAutoRunning(true);
      clearHint();
      setSelected(null);
      window.clearTimeout(idleTimer.current);
      let i = 0;
      const step = () => {
        if (autoToken.current !== token || phaseRef.current !== "playing") return;
        const s = plan[i++];
        if (!s) {
          autoActive.current = false;
          setAutoRunning(false);
          return;
        }
        const g = gameRef.current;
        if (s.kind === "draw") {
          const r = drawFromStock(g, true);
          if (r) {
            commit(g, r.game, r.delta);
            fb.draw(r.recycled, 0);
          }
        } else {
          const r = applyMove(g, s.move);
          if (r) {
            commit(g, r.game, r.delta);
            emitMoveFx(s.move, r, r.game);
          }
        }
        if (phaseRef.current !== "playing") return;
        at(Math.max(100, 200 - i * 4), step);
      };
      step();
    }

    function markInput() {
      if (phaseRef.current === "playing") resetIdle();
    }

    function clearSelection() {
      if (selRef.current) setSelected(null);
    }

    return {
      startGame,
      leave,
      move,
      draw,
      autoMove,
      tap,
      activate,
      undo,
      showHint,
      pause,
      resume,
      autoFinish,
      markInput,
      clearSelection,
      getMeta: () => metaRef.current,
      getGame: () => gameRef.current,
      getPhase: () => phaseRef.current,
      canAct,
    };
  }, []);

  useEffect(() => {
    if (typeof Worker === "undefined") return;
    let worker: Worker;
    try {
      worker = new Worker(new URL("../game/progress.worker.ts", import.meta.url), { type: "module" });
    } catch { return; }
    progressWorker.current = worker;
    worker.onerror = () => {
      worker.terminate();
      if (progressWorker.current === worker) progressWorker.current = null;
    };
    return () => {
      worker.terminate();
      progressWorker.current = null;
    };
  }, []);

  // game clock + time penalty (−2 every 10s)
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.max(0, now - last);
      last = now;
      if (document.hidden || phaseRef.current !== "playing" || stageRef.current !== 3) return;
      const before = Math.floor(msRef.current / 1000);
      msRef.current += dt;
      const after = Math.floor(msRef.current / 1000);
      if (after !== before) {
        setSeconds(after);
        const penalties = Math.floor(after / 10) - Math.floor(before / 10);
        if (penalties > 0) {
          const g = gameRef.current;
          if (g.score > 0) {
            const ng = { ...g, score: Math.max(0, g.score - 2 * penalties) };
            gameRef.current = ng;
            setGame(ng);
          }
        }
      }
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  // auto-pause when the tab is hidden
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) ctl.pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [ctl]);

  // cleanup timers on unmount
  useEffect(
    () => () => {
      autoToken.current++;
      autoActive.current = false;
      fb.stopWin();
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
      window.clearTimeout(stuckTimer.current);
      window.clearTimeout(hintTimer.current);
      window.clearTimeout(idleTimer.current);
    },
    [],
  );

  return {
    ...ctl,
    game,
    phase,
    stage,
    seconds,
    selected,
    hint,
    canAuto,
    autoRunning,
    result,
    histLen,
    combo,
  };
}
