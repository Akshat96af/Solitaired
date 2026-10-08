import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Icon } from "./Icons";
import type { IconName } from "./Icons";
import { fmtTime } from "./Hud";
import { useTween } from "../hooks/useTween";
import type { ScoreEntry } from "../game/storage";
import type { GameResult } from "../hooks/useKlondike";

export function Modal({
  children,
  onClose,
  blur = true,
  z = 80,
  label,
  wide,
}: {
  children: ReactNode;
  onClose?: () => void;
  blur?: boolean;
  z?: number;
  label: string;
  wide?: boolean;
}) {
  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center p-3"
      style={{ zIndex: z }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.4), rgba(0,0,0,0.8))",
          backdropFilter: blur ? "blur(6px)" : undefined,
          WebkitBackdropFilter: blur ? "blur(6px)" : undefined,
        }}
        onPointerDown={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`glass film-grain relative flex max-h-[92dvh] w-full flex-col overflow-hidden ${wide ? "max-w-xl" : "max-w-md"}`}
        initial={{ y: 46, scale: 0.93, opacity: 0, filter: "blur(10px)" }}
        animate={{ y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
        exit={{ y: 26, scale: 0.96, opacity: 0, filter: "blur(6px)" }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClick}
      className="btn btn-ghost absolute right-3 top-3 z-10 h-9 w-9 rounded-xl"
    >
      <Icon name="x" size={16} />
    </button>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-sm font-semibold text-[#f4ecd8] hover:border-gold-400/50"
    >
      {label}
      <span
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{ background: on ? "linear-gradient(180deg,#fbe9a0,#c08f22)" : "rgba(255,255,255,0.14)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ left: on ? 22 : 2 }}
        />
      </span>
    </button>
  );
}

function MenuButton({
  icon,
  children,
  onClick,
  gold,
  autoFocus,
}: {
  icon: IconName;
  children: ReactNode;
  onClick: () => void;
  gold?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      onClick={onClick}
      className={`btn ${gold ? "btn-gold" : "btn-ghost"} h-12 w-full justify-start gap-3 px-4 text-sm`}
    >
      <Icon name={icon} size={18} />
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Pause                                                               */
/* ------------------------------------------------------------------ */
export function PauseModal(p: {
  sound: boolean;
  shake: boolean;
  onResume: () => void;
  onRestart: () => void;
  onNew: () => void;
  onScores: () => void;
  onHelp: () => void;
  onMenu: () => void;
  onSound: (v: boolean) => void;
  onShake: (v: boolean) => void;
}) {
  return (
    <Modal label="Paused" onClose={p.onResume}>
      <div className="px-6 pb-6 pt-7">
        <p className="text-center font-display text-[11px] font-semibold uppercase tracking-[0.5em] text-gold-300/70">
          Game
        </p>
        <h2 className="title-shine mb-5 text-center font-display text-4xl font-black tracking-[0.12em]">PAUSED</h2>
        <div className="flex flex-col gap-2">
          <MenuButton icon="play" gold onClick={p.onResume} autoFocus>
            Resume <span className="kbd ml-auto hidden sm:inline-block">Esc</span>
          </MenuButton>
          <MenuButton icon="refresh" onClick={p.onRestart}>
            Restart this deal <span className="kbd ml-auto hidden sm:inline-block">R</span>
          </MenuButton>
          <MenuButton icon="shuffle" onClick={p.onNew}>
            New deal <span className="kbd ml-auto hidden sm:inline-block">N</span>
          </MenuButton>
          <MenuButton icon="trophy" onClick={p.onScores}>
            High scores
          </MenuButton>
          <MenuButton icon="help" onClick={p.onHelp}>
            How to play
          </MenuButton>
          <MenuButton icon="home" onClick={p.onMenu}>
            Main menu
          </MenuButton>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Toggle label="Sound" on={p.sound} onChange={p.onSound} />
          <Toggle label="Screen shake" on={p.shake} onChange={p.onShake} />
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Result (win / no more moves)                                        */
/* ------------------------------------------------------------------ */
function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/5 py-1.5 text-sm last:border-0">
      <span className="text-[#f4ecd8]/60">{label}</span>
      <span className={`tabular-nums ${strong ? "font-bold text-gold-200" : "font-semibold text-[#f4ecd8]"}`}>{value}</span>
    </div>
  );
}

export function ResultModal(p: {
  result: GameResult;
  name: string;
  onName: (n: string) => void;
  onAgain: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onScores: () => void;
}) {
  const r = p.result;
  const shown = useTween(r.score, 1300);
  const [draft, setDraft] = useState(p.name);
  useEffect(() => setDraft(p.name), [p.name]);

  const headline = r.won ? "YOU WIN" : "NO MORE MOVES";
  const sub = r.won ? "A flawless finish" : "The table is stuck";
  const rankText =
    r.rank === 1
      ? "★ NEW HIGH SCORE ★"
      : r.rank > 0
        ? `Ranked #${r.rank} on your table`
        : r.won
          ? "Not quite top 10 — go again"
          : "Score not in the top 10";

  return (
    <Modal label={headline} blur={!r.won} z={82}>
      <div className="px-6 pb-6 pt-7 text-center">
        <motion.p
          initial={{ opacity: 0, letterSpacing: "0.1em" }}
          animate={{ opacity: 1, letterSpacing: "0.5em" }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          className={`font-display text-[11px] font-semibold uppercase ${r.won ? "text-gold-300/80" : "text-rose-300/80"}`}
        >
          {sub}
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, scale: 1.4, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={`mt-1 font-display font-black leading-tight tracking-[0.1em] ${
            r.won ? "title-shine text-5xl" : "text-4xl text-rose-200"
          }`}
          style={r.won ? undefined : { textShadow: "0 0 30px rgba(224,54,79,0.55)" }}
        >
          {headline}
        </motion.h2>

        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-300/60">Final score</div>
          <div className="text-gold font-display text-6xl font-black tabular-nums leading-tight">{shown.toLocaleString()}</div>
          <div className={`mt-1 text-xs font-bold tracking-widest ${r.rank === 1 ? "text-gold-200" : "text-[#f4ecd8]/60"}`}>
            {rankText}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-1.5 text-left">
          <Row label="Cards on foundations" value={`${r.foundation} / 52`} />
          <Row label="Play score" value={r.base.toLocaleString()} />
          {r.won && <Row label="Time bonus" value={`+${r.bonus.toLocaleString()}`} strong />}
          <Row label="Time" value={fmtTime(r.seconds)} />
          <Row label="Moves" value={r.moves} />
          <Row label="Mode" value={`Draw ${r.draw}${r.daily ? " · Daily" : ""}`} />
        </div>

        {r.won && r.entryId && (
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-300/70">Name</span>
            <input
              value={draft}
              maxLength={12}
              onChange={(e) => setDraft(e.target.value.toUpperCase())}
              onBlur={() => p.onName(draft.trim() || "PLAYER")}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="min-w-0 flex-1 bg-transparent text-right font-display text-lg font-bold tracking-widest text-gold-200 outline-none"
              aria-label="Your name for the high-score table"
            />
          </label>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {r.won ? (
            <button type="button" autoFocus onClick={p.onAgain} className="btn btn-gold btn-glow h-14 text-base tracking-[0.18em]">
              <Icon name="refresh" size={20} /> PLAY AGAIN
            </button>
          ) : (
            <>
              <button type="button" autoFocus onClick={p.onUndo} className="btn btn-gold h-12 text-sm tracking-[0.12em]">
                <Icon name="undo" size={18} /> UNDO LAST MOVE
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={p.onAgain} className="btn btn-ghost h-12 text-sm">
                  <Icon name="shuffle" size={17} /> New deal
                </button>
                <button type="button" onClick={p.onRestart} className="btn btn-ghost h-12 text-sm">
                  <Icon name="refresh" size={17} /> Retry deal
                </button>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={p.onScores} className="btn btn-ghost h-11 text-sm">
              <Icon name="trophy" size={17} /> Scores
            </button>
            <button type="button" onClick={p.onMenu} className="btn btn-ghost h-11 text-sm">
              <Icon name="home" size={17} /> Menu
            </button>
          </div>
        </div>
        <p className="mt-3 hidden text-[11px] text-[#f4ecd8]/40 sm:block">
          <span className="kbd">Enter</span> {r.won ? "play again" : "undo"} · <span className="kbd">N</span> new deal ·{" "}
          <span className="kbd">R</span> retry · <span className="kbd">Esc</span> menu
        </p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* High scores                                                         */
/* ------------------------------------------------------------------ */
export function ScoresModal(p: {
  scores: ScoreEntry[];
  highlight?: string;
  onClose: () => void;
  onClear: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal label="High scores" onClose={p.onClose} z={90} wide>
      <CloseButton onClick={p.onClose} />
      <div className="px-5 pb-5 pt-6 sm:px-7">
        <p className="text-center font-display text-[11px] font-semibold uppercase tracking-[0.5em] text-gold-300/70">
          Hall of fame
        </p>
        <h2 className="title-shine mb-4 text-center font-display text-3xl font-black tracking-[0.1em]">HIGH SCORES</h2>

        {p.scores.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 py-10 text-center text-sm text-[#f4ecd8]/60">
            <div className="mb-2 text-4xl opacity-60">♠ ♥ ♦ ♣</div>
            No scores yet. Finish a game to claim the first spot.
          </div>
        ) : (
          <div className="scroll-y max-h-[52dvh] rounded-2xl border border-white/10 bg-black/25">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#06281c] text-[10px] uppercase tracking-[0.18em] text-gold-300/70">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Player</th>
                  <th className="px-2 py-2 text-right">Score</th>
                  <th className="hidden px-2 py-2 text-right sm:table-cell">Time</th>
                  <th className="hidden px-2 py-2 text-right sm:table-cell">Moves</th>
                  <th className="px-3 py-2 text-right">Mode</th>
                </tr>
              </thead>
              <tbody>
                {p.scores.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`border-t border-white/5 ${e.id === p.highlight ? "bg-gold-400/15" : ""}`}
                  >
                    <td className="px-3 py-2 font-display font-bold text-gold-300">
                      {i === 0 ? "♛" : i + 1}
                    </td>
                    <td className="max-w-[110px] truncate px-2 py-2 font-semibold">
                      {e.name} {e.won && <span className="text-gold-300" title="Won">★</span>}
                    </td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums text-gold-200">{e.score.toLocaleString()}</td>
                    <td className="hidden px-2 py-2 text-right tabular-nums text-[#f4ecd8]/70 sm:table-cell">{fmtTime(e.seconds)}</td>
                    <td className="hidden px-2 py-2 text-right tabular-nums text-[#f4ecd8]/70 sm:table-cell">{e.moves}</td>
                    <td className="px-3 py-2 text-right text-xs text-[#f4ecd8]/70">
                      D{e.draw}
                      {e.daily ? " ◆" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {p.scores.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm) {
                  p.onClear();
                  setConfirm(false);
                } else {
                  setConfirm(true);
                  window.setTimeout(() => setConfirm(false), 2500);
                }
              }}
              className="btn btn-ghost h-11 flex-1 text-sm"
            >
              {confirm ? "Tap again to erase" : "Reset table"}
            </button>
          )}
          <button type="button" autoFocus onClick={p.onClose} className="btn btn-gold h-11 flex-1 text-sm">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Help                                                                */
/* ------------------------------------------------------------------ */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-1.5 font-display text-xs font-bold uppercase tracking-[0.25em] text-gold-300">{title}</h3>
      <div className="space-y-1.5 text-sm leading-relaxed text-[#f4ecd8]/80">{children}</div>
    </section>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="How to play" onClose={onClose} z={90} wide>
      <CloseButton onClick={onClose} />
      <div className="px-5 pb-5 pt-6 sm:px-7">
        <h2 className="title-shine mb-4 text-center font-display text-3xl font-black tracking-[0.1em]">HOW TO PLAY</h2>
        <div className="scroll-y max-h-[60dvh] pr-1">
          <Section title="Goal">
            <p>
              Build all four foundations from <b>Ace to King</b> in a single suit. Tableau columns build{" "}
              <b>downward in alternating colours</b>. Only Kings can fill an empty column.
            </p>
          </Section>
          <Section title="Touch & mouse">
            <p>
              <b>Drag</b> a card (or a whole run) to a pile. <b>Tap</b> a card to select it, then tap where it should go.{" "}
              <b>Double-tap</b> sends a card to a foundation — or the best column. Tap the stock to draw.
            </p>
          </Section>
          <Section title="Keyboard">
            <p>
              <span className="kbd">←</span> <span className="kbd">→</span> <span className="kbd">↑</span>{" "}
              <span className="kbd">↓</span> move the cursor (↑ extends the run) · <span className="kbd">Space</span> /{" "}
              <span className="kbd">Enter</span> pick up / place / draw · <span className="kbd">F</span> send to foundation ·{" "}
              <span className="kbd">D</span> draw · <span className="kbd">1</span>–<span className="kbd">7</span> jump to a column
            </p>
            <p>
              <span className="kbd">U</span> undo · <span className="kbd">H</span> hint · <span className="kbd">A</span>{" "}
              auto-finish · <span className="kbd">P</span> / <span className="kbd">Esc</span> pause · <span className="kbd">N</span>{" "}
              new deal · <span className="kbd">R</span> retry deal · <span className="kbd">M</span> mute
            </p>
          </Section>
          <Section title="Scoring">
            <p>
              Waste → tableau <b>+5</b> · Any card → foundation <b>+10</b> · Turn over a card <b>+5</b> · Foundation → tableau{" "}
              <b>−15</b> · Every 10 s <b>−2</b> · Recycling the stock costs <b>−100</b> (Draw 1) or <b>−20</b> after 3 passes
              (Draw 3). Win fast for a big <b>time bonus</b>. Chain foundation plays for combos!
            </p>
          </Section>
          <Section title="Modes">
            <p>
              <b>Draw 1</b> is relaxed, <b>Draw 3</b> is the classic challenge. <b>Daily Deal</b> gives everyone the same shuffle
              today.
            </p>
          </Section>
        </div>
        <button type="button" autoFocus onClick={onClose} className="btn btn-gold mt-3 h-11 w-full text-sm">
          Got it
        </button>
      </div>
    </Modal>
  );
}
