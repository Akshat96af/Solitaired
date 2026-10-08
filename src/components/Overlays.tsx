import { motion } from "motion/react";

/** Cinematic shutter wipe: two panels close to a glowing gold seam, then open. */
export function Wipe({ closed, busy, tick }: { closed: boolean; busy: boolean; tick: number }) {
  const ease = [0.76, 0, 0.24, 1] as const;
  return (
    <div className="fixed inset-0 z-[95]" style={{ pointerEvents: busy ? "auto" : "none" }}>
      <motion.div
        className="film-grain absolute inset-x-0 top-0 origin-top"
        style={{
          height: "50.5%",
          background: "linear-gradient(180deg,#010806 0%,#04170f 100%)",
          borderBottom: "1px solid rgba(233,193,90,0.55)",
        }}
        initial={false}
        animate={{ scaleY: closed ? 1 : 0 }}
        transition={{ duration: 0.55, ease }}
      />
      <motion.div
        className="film-grain absolute inset-x-0 bottom-0 origin-bottom"
        style={{
          height: "50.5%",
          background: "linear-gradient(0deg,#010806 0%,#04170f 100%)",
          borderTop: "1px solid rgba(233,193,90,0.55)",
        }}
        initial={false}
        animate={{ scaleY: closed ? 1 : 0 }}
        transition={{ duration: 0.55, ease }}
      />
      {closed && (
        <div
          key={tick}
          className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2"
          style={{
            background: "linear-gradient(90deg, transparent, #fff1b8 30%, #ffffff 50%, #fff1b8 70%, transparent)",
            boxShadow: "0 0 22px 5px rgba(246,221,139,0.8)",
            animation: "wipe-line 1s ease-out 0.35s both",
          }}
        />
      )}
    </div>
  );
}

/** Cinematic letterbox bars used for the victory shot. */
export function Letterbox({ show }: { show: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[66]">
      <motion.div
        className="absolute inset-x-0 top-0 origin-top bg-black"
        style={{ height: "8.5vh", borderBottom: "1px solid rgba(233,193,90,0.35)" }}
        initial={false}
        animate={{ scaleY: show ? 1 : 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 origin-bottom bg-black"
        style={{ height: "8.5vh", borderTop: "1px solid rgba(233,193,90,0.35)" }}
        initial={false}
        animate={{ scaleY: show ? 1 : 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
