import { useRef } from "react";
import type { ReactNode } from "react";
import { Icon } from "./Icons";
import type { IconName } from "./Icons";
import { useTween } from "../hooks/useTween";

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

function Stat({ label, children, accent, className = "" }: { label: string; children: ReactNode; accent?: boolean; className?: string }) {
  return (
    <div
      className={`hud-pill flex min-w-0 flex-col items-center justify-center px-2.5 py-1 sm:px-5 [@media(max-height:480px)]:py-0 ${className}`}
      style={accent ? { borderColor: "rgba(233,193,90,0.5)" } : undefined}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-gold-300/70 sm:text-[10px] [@media(max-height:480px)]:hidden">
        {label}
      </span>
      <span
        className={`font-display font-bold leading-tight tabular-nums ${
          accent ? "text-gold text-xl sm:text-3xl" : "text-lg text-[#f4ecd8] sm:text-2xl"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

function ScoreNumber({ value }: { value: number }) {
  const shown = useTween(value, 480);
  const prev = useRef(value);
  const popKey = useRef(0);
  if (value > prev.current) popKey.current++;
  prev.current = value;
  return (
    <span key={popKey.current} className={popKey.current ? "pop inline-block" : "inline-block"}>
      {shown.toLocaleString()}
    </span>
  );
}

export interface HudProps {
  score: number;
  best: number;
  seconds: number;
  moves: number;
  foundation: number;
  draw: 1 | 3;
  sound: boolean;
  combo: number;
  onPause: () => void;
  onToggleSound: () => void;
}

export function Hud(p: HudProps) {
  return (
    <header className="relative z-20 shrink-0 px-2 pb-1.5 pt-[max(env(safe-area-inset-top),8px)] sm:px-5">
      <div className="mx-auto flex max-w-[1100px] items-stretch gap-2">
        <IconButton icon="pause" label="Pause (Esc)" onClick={p.onPause} />
        <div className="flex min-w-0 flex-1 items-stretch justify-center gap-1.5 sm:gap-3">
          <Stat label="Score" accent className="min-w-[96px] flex-[1.3] sm:min-w-[170px] sm:flex-none">
            <ScoreNumber value={p.score} />
          </Stat>
          <Stat label="Time" className="flex-1 sm:flex-none">
            {fmtTime(p.seconds)}
          </Stat>
          <Stat label="Moves" className="flex-1 sm:flex-none">
            {p.moves}
          </Stat>
          <Stat label="Best" className="hidden md:flex">
            {p.best.toLocaleString()}
          </Stat>
          <div className="hud-pill hidden flex-col items-center justify-center px-4 py-1 lg:flex">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-300/70">Mode</span>
            <span className="font-display text-xl font-bold text-[#f4ecd8]">Draw {p.draw}</span>
          </div>
        </div>
        <IconButton icon={p.sound ? "volume" : "mute"} label="Toggle sound (M)" onClick={p.onToggleSound} />
      </div>
      <div className="mx-auto mt-1.5 h-[3px] max-w-[1100px] overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full"
          style={{
            width: `${(p.foundation / 52) * 100}%`,
            background: "linear-gradient(90deg,#b8861b,#fff1b8)",
            boxShadow: "0 0 12px rgba(246,221,139,0.8)",
            transition: "width 0.6s cubic-bezier(0.2,0.9,0.3,1)",
          }}
        />
      </div>
    </header>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  size = 20,
  className = "",
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  size?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`btn btn-ghost hud-pill h-auto w-11 shrink-0 sm:w-12 ${className}`}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

function ActionButton({
  icon,
  label,
  kbd,
  onClick,
  disabled,
  gold,
  glow,
}: {
  icon: IconName;
  label: string;
  kbd?: string;
  onClick: () => void;
  disabled?: boolean;
  gold?: boolean;
  glow?: boolean;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      title={kbd ? `${label} (${kbd})` : label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`btn ${gold ? "btn-gold" : "btn-ghost"} ${glow ? "btn-glow" : ""} h-11 px-3.5 text-[13px] sm:h-12 sm:px-5 sm:text-sm [@media(max-height:480px)]:h-9!`}
    >
      <Icon name={icon} size={18} />
      <span className="[@media(max-height:480px)]:hidden">{label}</span>
      {kbd && <span className="kbd hidden md:inline-block">{kbd}</span>}
    </button>
  );
}

export interface BottomBarProps {
  canUndo: boolean;
  canAuto: boolean;
  confirmNew: boolean;
  onUndo: () => void;
  onHint: () => void;
  onAuto: () => void;
  onNew: () => void;
}

export function BottomBar(p: BottomBarProps) {
  return (
    <footer className="relative z-20 shrink-0 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 sm:px-5">
      <div className="mx-auto flex max-w-[1100px] items-center justify-center gap-2">
        <ActionButton icon="undo" label="Undo" kbd="U" onClick={p.onUndo} disabled={!p.canUndo} />
        <ActionButton icon="bulb" label="Hint" kbd="H" onClick={p.onHint} />
        {p.canAuto && <ActionButton icon="sparkles" label="Auto-finish" kbd="A" onClick={p.onAuto} gold glow />}
        <ActionButton
          icon="shuffle"
          label={p.confirmNew ? "Sure?" : "New deal"}
          kbd="N"
          onClick={p.onNew}
          gold={p.confirmNew}
        />
      </div>
    </footer>
  );
}
