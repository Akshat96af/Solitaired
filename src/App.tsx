import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SvgDefs } from "./components/CardFace";
import { Board } from "./components/Board";
import { Hud, BottomBar } from "./components/Hud";
import { StartScreen } from "./components/StartScreen";
import { Cascade } from "./components/Cascade";
import { Wipe, Letterbox } from "./components/Overlays";
import { HelpModal, PauseModal, ResultModal, ScoresModal } from "./components/Modals";
import { useKlondike } from "./hooks/useKlondike";
import type { ToastTone } from "./hooks/useKlondike";
import { dailySeed, foundationCount, getPile, randomSeed, solvableSeed } from "./game/rules";
import type { Cursor, PileRef } from "./game/types";
import type { Game } from "./game/types";
import {
  bestScore,
  clearScores,
  loadScores,
  loadSettings,
  loadStats,
  renameScore,
  saveSettings,
} from "./game/storage";
import type { ScoreEntry, Settings } from "./game/storage";
import { setMuted, sfx, unlock } from "./fx/audio";
import { setShakeEnabled, setShakeTarget } from "./fx/shake";
import * as P from "./fx/particles";
import { boardApi } from "./fx/effects";
import { useTimeouts } from "./hooks/useTimeouts";

interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
}

type Dir = "left" | "right" | "up" | "down";
const TOP_COLS = [0, 1, 3, 4, 5, 6];

function cursorCol(c: Cursor): number {
  switch (c.pile.type) {
    case "stock":
      return 0;
    case "waste":
      return 1;
    case "foundation":
      return 3 + c.pile.index;
    default:
      return c.pile.index;
  }
}

function topPileAtCol(col: number): PileRef {
  if (col === 0) return { type: "stock", index: 0 };
  if (col <= 2) return { type: "waste", index: 0 };
  return { type: "foundation", index: col - 3 };
}

function navigate(c: Cursor | null, dir: Dir, g: Game): Cursor {
  if (!c) return { pile: { type: "tableau", index: 0 }, depth: 0 };
  const isTop = c.pile.type !== "tableau";
  const col = cursorCol(c);
  if (dir === "left" || dir === "right") {
    const d = dir === "left" ? -1 : 1;
    if (isTop) {
      const i = TOP_COLS.indexOf(col);
      const ni = Math.min(TOP_COLS.length - 1, Math.max(0, i + d));
      return { pile: topPileAtCol(TOP_COLS[ni]), depth: 0 };
    }
    return { pile: { type: "tableau", index: (col + d + 7) % 7 }, depth: 0 };
  }
  if (dir === "up") {
    if (isTop) return c;
    const faceUp = g.tableau[c.pile.index].filter((x) => x.up).length;
    if (c.depth < faceUp - 1) return { ...c, depth: c.depth + 1 };
    return { pile: topPileAtCol(col), depth: 0 };
  }
  if (isTop) return { pile: { type: "tableau", index: col }, depth: 0 };
  if (c.depth > 0) return { ...c, depth: c.depth - 1 };
  return c;
}

export default function App() {
  const schedule = useTimeouts();
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    saveSettings(settings);
    setMuted(!settings.sound);
    setShakeEnabled(settings.shake);
  }, [settings]);

  /* toasts */
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const pushToast = useCallback((text: string, tone: ToastTone = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-1), { id, text, tone }]);
    schedule(() => setToasts((t) => t.filter((x) => x.id !== id)), 2300);
  }, [schedule]);

  const k = useKlondike(pushToast, () => settingsRef.current.name);
  const kRef = useRef(k);
  kRef.current = k;

  /* screens + cinematic wipe */
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [wipeClosed, setWipeClosed] = useState(true);
  const [wipeBusy, setWipeBusy] = useState(true);
  const [wipeTick, setWipeTick] = useState(0);
  const busyRef = useRef(true);

  useEffect(() => {
    const t1 = window.setTimeout(() => setWipeClosed(false), 450);
    const t2 = window.setTimeout(() => {
      busyRef.current = false;
      setWipeBusy(false);
    }, 1150);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const transition = useCallback((fn: () => void) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setWipeBusy(true);
    unlock();
    sfx.whoosh(true);
    setWipeTick((t) => t + 1);
    setWipeClosed(true);
    schedule(() => {
      fn();
      schedule(() => {
        setWipeClosed(false);
        schedule(() => {
          busyRef.current = false;
          setWipeBusy(false);
        }, 640);
      }, 140);
    }, 640);
  }, [schedule]);

  /* modals */
  const [modal, setModal] = useState<null | "scores" | "help">(null);
  const [scoreList, setScoreList] = useState<ScoreEntry[]>([]);
  const openScores = useCallback(() => {
    sfx.ui();
    setScoreList(loadScores());
    setModal("scores");
  }, []);
  const openHelp = useCallback(() => {
    sfx.ui();
    setModal("help");
  }, []);

  /* keyboard cursor */
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  const effCursor = useMemo<Cursor | null>(() => {
    if (!cursor) return null;
    if (cursor.pile.type !== "tableau") return { pile: cursor.pile, depth: 0 };
    const col = k.game.tableau[cursor.pile.index];
    const up = col.filter((c) => c.up).length;
    return { pile: cursor.pile, depth: Math.min(cursor.depth, Math.max(0, up - 1)) };
  }, [cursor, k.game]);

  /* actions */
  const startFromMenu = useCallback(
    (daily: boolean) => {
      unlock();
      transition(() => {
        setScreen("game");
        setModal(null);
        setCursor(null);
        setShowCursor(false);
        kRef.current.startGame({
          seed: solvableSeed(daily ? dailySeed() : randomSeed(), settingsRef.current.draw),
          draw: settingsRef.current.draw,
          daily,
          fromMenu: true,
        });
        sfx.start();
      });
    },
    [transition],
  );

  const restartDeal = useCallback(() => {
    const g = kRef.current.getGame();
    setModal(null);
    kRef.current.startGame({ seed: g.seed, draw: g.drawCount, daily: kRef.current.getMeta().daily });
  }, []);

  const newDeal = useCallback(() => {
    setModal(null);
    kRef.current.startGame({ seed: solvableSeed(randomSeed(), settingsRef.current.draw), draw: settingsRef.current.draw });
  }, []);

  const toMenu = useCallback(() => {
    transition(() => {
      kRef.current.leave();
      setScreen("menu");
      setModal(null);
    });
  }, [transition]);

  const [confirmNew, setConfirmNew] = useState(false);
  const confirmRef = useRef("");
  const confirmTimer = useRef(0);
  const confirmAction = useCallback(
    (kind: string, label: string, fn: () => void) => {
      if (kRef.current.getGame().moves === 0) {
        fn();
        return;
      }
      if (confirmRef.current === kind) {
        confirmRef.current = "";
        setConfirmNew(false);
        fn();
        return;
      }
      confirmRef.current = kind;
      setConfirmNew(kind === "new");
      pushToast(label, "warn");
      window.clearTimeout(confirmTimer.current);
      confirmTimer.current = schedule(() => {
        confirmRef.current = "";
        setConfirmNew(false);
      }, 2000);
    },
    [pushToast, schedule],
  );

  const toggleSound = useCallback(() => setSettings((s) => ({ ...s, sound: !s.sound })), []);
  const onInput = useCallback(() => {
    unlock();
    setShowCursor(false);
    kRef.current.markInput();
  }, []);
  const onTapPile = useCallback((p: PileRef) => kRef.current.tap(p, -1), []);

  /* result modal timing */
  const [resultVisible, setResultVisible] = useState(false);
  useEffect(() => {
    if (k.phase === "won") {
      setResultVisible(false);
      const t = window.setTimeout(() => setResultVisible(true), 2700);
      return () => window.clearTimeout(t);
    }
    if (k.phase === "stuck") {
      setResultVisible(false);
      const t = window.setTimeout(() => setResultVisible(true), 650);
      return () => window.clearTimeout(t);
    }
    setResultVisible(false);
  }, [k.phase]);

  /* global listeners / registries */
  const fxRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    P.attach(fxRef.current);
    boardApi.flash = (color = "#ffffff") => {
      const el = flashRef.current;
      if (!el) return;
      el.style.background = `radial-gradient(ellipse at 50% 40%, ${color} 0%, transparent 72%)`;
      el.animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: 560, easing: "ease-out" });
    };
    const onDown = () => unlock();
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      P.attach(null);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  const shakeRef = useCallback((el: HTMLDivElement | null) => setShakeTarget(el), []);

  /* keyboard */
  const S = useRef({ k, screen, modal, cursor: effCursor, showCursor, resultVisible, busy: wipeBusy });
  S.current = { k, screen, modal, cursor: effCursor, showCursor, resultVisible, busy: wipeBusy };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = S.current;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape" || e.key === "Enter") t?.blur();
        return;
      }
      if (e.metaKey || e.altKey) return;
      unlock();
      if (s.busy) return;
      const key = e.key;
      const lower = key.toLowerCase();
      const onBtn = tag === "BUTTON";
      const kk = s.k;

      if (s.modal) {
        if (key === "Escape") {
          e.preventDefault();
          setModal(null);
        }
        return;
      }

      if (s.screen === "menu") {
        if ((key === "Enter" || key === " ") && !onBtn) {
          e.preventDefault();
          startFromMenu(false);
        }
        return;
      }

      const phase = kk.phase;
      if (phase === "paused") {
        if (key === "Escape" || lower === "p" || ((key === "Enter" || key === " ") && !onBtn)) {
          e.preventDefault();
          kk.resume();
        } else if (lower === "r") restartDeal();
        else if (lower === "n") newDeal();
        else if (lower === "m") toggleSound();
        return;
      }

      if (phase === "won" || phase === "stuck") {
        if (!s.resultVisible) return;
        if (lower === "n") {
          e.preventDefault();
          newDeal();
        } else if (lower === "r") {
          e.preventDefault();
          restartDeal();
        } else if (key === "Enter" && !onBtn) {
          e.preventDefault();
          if (phase === "won") newDeal();
          else kk.undo();
        } else if (key === "Escape") {
          e.preventDefault();
          toMenu();
        } else if (phase === "stuck" && (lower === "u" || (lower === "z" && e.ctrlKey))) {
          e.preventDefault();
          kk.undo();
        }
        return;
      }
      if (phase !== "playing") return;

      if (key === "Escape") {
        e.preventDefault();
        if (kk.selected) kk.clearSelection();
        else kk.pause();
        return;
      }
      if (lower === "p") return kk.pause();
      if (lower === "u" || (lower === "z" && e.ctrlKey)) {
        e.preventDefault();
        kk.undo();
        return;
      }
      if (lower === "h") return kk.showHint();
      if (lower === "a") {
        if (kk.canAuto) kk.autoFinish();
        else pushToast("Auto-finish unlocks once every card is face-up", "info");
        return;
      }
      if (lower === "m") return toggleSound();
      if (lower === "n") return confirmAction("new", "Press N again for a new deal", newDeal);
      if (lower === "r") return confirmAction("retry", "Press R again to retry this deal", restartDeal);
      if (lower === "d") return kk.draw();

      const dirs: Record<string, Dir> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
      const dir = dirs[key];
      if (dir) {
        e.preventDefault();
        if (!s.showCursor) {
          setShowCursor(true);
          setCursor((c) => c ?? { pile: { type: "tableau", index: 0 }, depth: 0 });
        } else {
          const g = kk.getGame();
          setCursor(navigate(s.cursor, dir, g));
        }
        return;
      }
      if (/^[1-7]$/.test(key)) {
        setShowCursor(true);
        setCursor({ pile: { type: "tableau", index: Number(key) - 1 }, depth: 0 });
        return;
      }
      if (key === "Enter" || key === " ") {
        e.preventDefault();
        if (!s.showCursor || !s.cursor) {
          setShowCursor(true);
          setCursor((c) => c ?? { pile: { type: "tableau", index: 0 }, depth: 0 });
          return;
        }
        kk.activate(s.cursor.pile, s.cursor.depth);
        return;
      }
      if (lower === "f") {
        const c = s.cursor;
        if (!s.showCursor || !c) {
          pushToast("Move the cursor onto a card first", "info");
          return;
        }
        const cards = getPile(kk.getGame(), c.pile);
        if (!cards.length) return;
        const idx = c.pile.type === "tableau" ? Math.max(0, cards.length - 1 - c.depth) : cards.length - 1;
        kk.autoMove(c.pile, cards.length - idx);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startFromMenu, restartDeal, newDeal, toMenu, toggleSound, confirmAction, pushToast]);

  const best = useMemo(() => bestScore(), [k.phase, screen, scoreList]);
  const stats = useMemo(() => loadStats(), [k.phase, screen]);
  const inGame = screen === "game";

  return (
    <div className="fixed inset-0 overflow-hidden bg-felt-950 font-ui" onContextMenu={(e) => e.preventDefault()}>
      <SvgDefs />

      {screen === "menu" ? (
        <StartScreen
          draw={settings.draw}
          best={best}
          stats={stats}
          sound={settings.sound}
          onDraw={(d) => {
            sfx.ui();
            setSettings((s) => ({ ...s, draw: d }));
          }}
          onPlay={() => startFromMenu(false)}
          onDaily={() => startFromMenu(true)}
          onScores={openScores}
          onHelp={openHelp}
          onToggleSound={toggleSound}
        />
      ) : (
        <motion.div
          key="game"
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="table-bg" />
          <div className="table-light" />
          <div ref={shakeRef} className="relative z-10 flex h-full w-full flex-col">
            <Hud
              score={k.game.score}
              best={Math.max(best, k.game.score)}
              seconds={k.seconds}
              moves={k.game.moves}
              foundation={foundationCount(k.game)}
              draw={k.game.drawCount}
              sound={settings.sound}
              combo={k.combo}
              onPause={k.pause}
              onToggleSound={toggleSound}
            />
            <div className="relative min-h-0 flex-1">
              <Board
                game={k.game}
                stage={k.stage}
                selected={k.selected}
                hint={k.hint}
                cursor={effCursor}
                showCursor={showCursor && k.phase === "playing"}
                paused={k.phase === "paused"}
                interactive={k.phase === "playing" && k.stage === 3 && !k.autoRunning}
                onDraw={k.draw}
                onTapCard={k.tap}
                onTapPile={onTapPile}
                onMove={k.move}
                onInput={onInput}
                onDragStart={k.clearSelection}
              />
              <AnimatePresence>
                {k.phase === "playing" && k.stage === 3 && k.game.moves === 0 && (
                  <motion.div
                    key="coach"
                    className="pointer-events-none absolute inset-x-0 bottom-1 z-30 flex justify-center px-3"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: 0.4, duration: 0.6 } }}
                    exit={{ opacity: 0, y: 14, transition: { duration: 0.25 } }}
                  >
                    <div className="hud-pill px-4 py-2 text-center text-[11px] text-[#f4ecd8]/85 sm:text-xs">
                      <b className="text-gold-200">Drag</b> cards · <b className="text-gold-200">tap</b> to select ·{" "}
                      <b className="text-gold-200">double-tap</b> sends it up
                      <span className="hidden md:inline"> · arrow keys + Space also work</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <BottomBar
              canUndo={k.histLen > 0 && k.phase === "playing"}
              canAuto={k.canAuto && k.phase === "playing" && !k.autoRunning}
              confirmNew={confirmNew}
              onUndo={() => k.undo()}
              onHint={() => k.showHint()}
              onAuto={k.autoFinish}
              onNew={() => confirmAction("new", "Tap again to start a new deal", newDeal)}
            />
          </div>
        </motion.div>
      )}

      {/* victory cascade + cinematic bars */}
      {inGame && k.phase === "won" && <Cascade foundations={k.game.foundations} />}
      <Letterbox show={inGame && k.phase === "won"} />

      {/* particles, flash, toasts */}
      <canvas ref={fxRef} className="pointer-events-none fixed inset-0 z-[70]" />
      <div ref={flashRef} className="pointer-events-none fixed inset-0 z-[75] opacity-0" />
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+84px)] z-[85] flex flex-col items-center gap-2 px-3">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -14, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="rounded-full border px-4 py-2 text-center text-xs font-semibold shadow-2xl sm:text-sm"
              style={{
                background: "rgba(3,22,15,0.92)",
                borderColor: t.tone === "warn" ? "rgba(255,138,138,0.6)" : t.tone === "good" ? "rgba(122,231,199,0.6)" : "rgba(233,193,90,0.5)",
                color: t.tone === "warn" ? "#ffd0d0" : "#fff1b8",
              }}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* modals */}
      <AnimatePresence>
        {inGame && k.phase === "paused" && (
          <PauseModal
            key="pause"
            sound={settings.sound}
            shake={settings.shake}
            onResume={k.resume}
            onRestart={restartDeal}
            onNew={newDeal}
            onScores={openScores}
            onHelp={openHelp}
            onMenu={toMenu}
            onSound={(v) => setSettings((s) => ({ ...s, sound: v }))}
            onShake={(v) => setSettings((s) => ({ ...s, shake: v }))}
          />
        )}
        {inGame && resultVisible && k.result && (k.phase === "won" || k.phase === "stuck") && (
          <ResultModal
            key="result"
            result={k.result}
            name={settings.name}
            onName={(n) => {
              if (k.result?.entryId) renameScore(k.result.entryId, n);
              setSettings((s) => ({ ...s, name: n }));
            }}
            onAgain={newDeal}
            onUndo={() => k.undo()}
            onRestart={restartDeal}
            onMenu={toMenu}
            onScores={openScores}
          />
        )}
        {modal === "scores" && (
          <ScoresModal
            key="scores"
            scores={scoreList}
            highlight={k.result?.entryId}
            onClose={() => setModal(null)}
            onClear={() => {
              clearScores();
              setScoreList([]);
            }}
          />
        )}
        {modal === "help" && <HelpModal key="help" onClose={() => setModal(null)} />}
      </AnimatePresence>

      <Wipe closed={wipeClosed} busy={wipeBusy} tick={wipeTick} />
    </div>
  );
}
