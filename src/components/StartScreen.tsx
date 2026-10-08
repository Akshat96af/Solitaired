import { useMemo } from "react";
import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { CardFace } from "./CardFace";
import { Icon } from "./Icons";
import type { Stats } from "../game/storage";
import type { Suit } from "../game/types";

const FAN: { suit: Suit; rank: number; angle: number; x: number; y: number }[] = [
  { suit: 0, rank: 1, angle: -26, x: -118, y: 18 },
  { suit: 1, rank: 13, angle: -13, x: -60, y: 4 },
  { suit: 3, rank: 12, angle: 0, x: 0, y: -4 },
  { suit: 2, rank: 11, angle: 13, x: 60, y: 4 },
  { suit: 1, rank: 1, angle: 26, x: 118, y: 18 },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.35 } },
};
const item = {
  hidden: { opacity: 0, y: 22, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

export interface StartScreenProps {
  draw: 1 | 3;
  best: number;
  stats: Stats;
  sound: boolean;
  onDraw: (d: 1 | 3) => void;
  onPlay: () => void;
  onDaily: () => void;
  onScores: () => void;
  onHelp: () => void;
  onToggleSound: () => void;
}

export function StartScreen(p: StartScreenProps) {
  const suits = useMemo(() => {
    const glyphs = ["♠", "♥", "♦", "♣"];
    return Array.from({ length: 18 }, (_, i) => {
      const r = (n: number) => {
        const s = Math.sin((i + 1) * 91.7 + n * 17.3) * 10000;
        return s - Math.floor(s);
      };
      const red = i % 4 === 1 || i % 4 === 2;
      return {
        g: glyphs[i % 4],
        style: {
          "--x": `${(r(1) * 100).toFixed(1)}%`,
          "--s": `${Math.round(22 + r(2) * 54)}px`,
          "--d": `${(22 + r(3) * 26).toFixed(1)}s`,
          "--delay": `${(-r(4) * 40).toFixed(1)}s`,
          "--o": (0.05 + r(5) * 0.08).toFixed(3),
          "--dx": `${Math.round((r(6) - 0.5) * 140)}px`,
          "--rot": `${Math.round((r(7) - 0.5) * 360)}deg`,
          "--c": red ? "#ff8a9a" : "#d9f5e8",
        } as CSSProperties,
      };
    });
  }, []);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06 }}
      transition={{ duration: 0.6 }}
    >
      <div className="table-bg" />
      <div className="table-light" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {suits.map((s, i) => (
          <span key={i} className="floating-suit" style={s.style}>
            {s.g}
          </span>
        ))}
      </div>

      <div className="scroll-y absolute inset-0 flex flex-col items-center px-4 pb-6 pt-[max(env(safe-area-inset-top),16px)]">
        <div className="flex w-full max-w-[1000px] justify-end">
          <button
            type="button"
            className="btn btn-ghost h-11 w-11"
            aria-label={p.sound ? "Mute" : "Unmute"}
            onClick={p.onToggleSound}
          >
            <Icon name={p.sound ? "volume" : "mute"} size={20} />
          </button>
        </div>

        <div className="my-auto flex w-full max-w-xl flex-col items-center py-4 text-center">
          {/* card fan */}
          <div className="relative mb-7 mt-2 h-[clamp(120px,22vh,190px)] w-full">
            <div className="bob absolute inset-0 flex items-center justify-center">
              {FAN.map((c, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    width: "clamp(66px, 15vmin, 108px)",
                    aspectRatio: "100 / 140",
                    borderRadius: "8%/5.7%",
                    boxShadow: "0 14px 30px rgba(0,0,0,0.5), 0 3px 8px rgba(0,0,0,0.4)",
                    zIndex: i === 2 ? 5 : 4 - Math.abs(i - 2),
                    transformOrigin: "50% 120%",
                  }}
                  initial={{ opacity: 0, y: 140, rotate: 0, x: 0, scale: 0.7 }}
                  animate={{ opacity: 1, y: c.y, rotate: c.angle, x: c.x * 0.9, scale: 1 }}
                  transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.15 + i * 0.09 }}
                >
                  <div className="card-face" style={{ borderRadius: "8%/5.7%" }}>
                    <CardFace suit={c.suit} rank={c.rank} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div variants={container} initial="hidden" animate="show" className="flex w-full flex-col items-center">
            <motion.p
              variants={item}
              className="font-display text-[11px] font-semibold uppercase tracking-[0.5em] text-gold-300/80 sm:text-xs"
            >
              Klondike · Royal Edition
            </motion.p>
            <motion.div variants={item} className="mt-2">
              <h1 className="title-shine font-display text-[clamp(2.6rem,11vw,5.6rem)] font-black leading-none tracking-[0.06em]">
                SOLITAIRE
              </h1>
            </motion.div>
            <motion.div variants={item} className="mt-3 flex items-center gap-3 text-gold-400/70">
              <span className="h-px w-14 bg-gradient-to-r from-transparent to-gold-400/70" />
              <span className="text-lg">♠ ♥ ♦ ♣</span>
              <span className="h-px w-14 bg-gradient-to-l from-transparent to-gold-400/70" />
            </motion.div>

            <motion.button
              variants={item}
              type="button"
              onClick={p.onPlay}
              autoFocus
              className="btn btn-gold btn-glow mt-8 h-14 w-full max-w-xs text-lg tracking-[0.2em] sm:h-16 sm:text-xl"
            >
              <Icon name="play" size={22} />
              PLAY
            </motion.button>

            <motion.div variants={item} className="mt-4 flex items-center gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
              {([1, 3] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => p.onDraw(d)}
                  className={`btn h-10 w-28 text-sm ${p.draw === d ? "btn-gold" : "text-[#f4ecd8]/70 hover:text-white"}`}
                  aria-pressed={p.draw === d}
                >
                  Draw {d}
                </button>
              ))}
            </motion.div>

            <motion.div variants={item} className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={p.onDaily} className="btn btn-ghost h-11 px-4 text-sm">
                <Icon name="calendar" size={17} /> Daily Deal
              </button>
              <button type="button" onClick={p.onScores} className="btn btn-ghost h-11 px-4 text-sm">
                <Icon name="trophy" size={17} /> High Scores
              </button>
              <button type="button" onClick={p.onHelp} className="btn btn-ghost h-11 px-4 text-sm">
                <Icon name="help" size={17} /> How to Play
              </button>
            </motion.div>

            <motion.div variants={item} className="mt-7 grid w-full max-w-sm grid-cols-3 gap-2 text-center">
              {[
                ["Best score", p.best.toLocaleString()],
                ["Games won", String(p.stats.won)],
                ["Best streak", String(p.stats.bestStreak)],
              ].map(([k, v]) => (
                <div key={k} className="hud-pill px-2 py-2">
                  <div className="font-display text-xl font-bold text-gold-200">{v}</div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gold-300/60">{k}</div>
                </div>
              ))}
            </motion.div>

            <motion.p variants={item} className="mt-5 hidden text-xs text-[#f4ecd8]/45 md:block">
              <span className="kbd">Enter</span> play · <span className="kbd">←↑↓→</span> move cursor ·{" "}
              <span className="kbd">Space</span> pick / place · <span className="kbd">H</span> hint
            </motion.p>

            <motion.div variants={item} className="mt-7 flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold-400/50" />
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-gold-300/55">
                Developed by{" "}
                <a
                  href="https://github.com/akshat96af"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Akshat96af on GitHub (opens in a new tab)"
                  className="font-display font-bold tracking-[0.2em] text-gold-200/90 underline decoration-gold-400/35 underline-offset-4 transition-colors hover:text-white hover:decoration-gold-200 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-200"
                >
                  Akshat96af
                </a>
              </p>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-gold-400/50" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
