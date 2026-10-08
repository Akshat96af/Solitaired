// Procedural sound engine — everything is synthesised with Web Audio, no assets.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

export function unlock(): void {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.85;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      master.connect(comp);
      comp.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 1.2);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch {
    /* audio unavailable */
  }
}

export function setMuted(v: boolean): void {
  muted = v;
}

function ready(): AudioContext | null {
  if (muted || !ctx || !master || !noiseBuf) return null;
  return ctx;
}

interface NoiseOpts {
  dur: number;
  f0: number;
  f1: number;
  q?: number;
  gain: number;
  delay?: number;
  type?: BiquadFilterType;
  rate?: number;
}

function noise(o: NoiseOpts): void {
  const c = ready();
  if (!c || !master || !noiseBuf) return;
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = (o.rate ?? 1) * (0.85 + Math.random() * 0.3);
  const f = c.createBiquadFilter();
  f.type = o.type ?? "bandpass";
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), t + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + Math.min(0.012, o.dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t, Math.random() * 0.4, o.dur + 0.05);
}

interface ToneOpts {
  freq: number;
  freq2?: number;
  dur: number;
  type?: OscillatorType;
  gain: number;
  delay?: number;
  attack?: number;
}

function tone(o: ToneOpts): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freq2) osc.frequency.exponentialRampToValueAtTime(o.freq2, t + o.dur);
  const g = c.createGain();
  const a = o.attack ?? 0.006;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
const noteHz = (semi: number, base = 523.25) => base * Math.pow(2, semi / 12);

export const sfx = {
  flick() {
    noise({ dur: 0.075, f0: 4600, f1: 1700, q: 0.9, gain: 0.34 });
  },
  deal(i: number) {
    noise({ dur: 0.06, f0: 4200 + (i % 5) * 220, f1: 1900, q: 1, gain: 0.22, rate: 1.1 });
  },
  thud() {
    noise({ dur: 0.1, f0: 2500, f1: 800, q: 0.8, gain: 0.28 });
    tone({ freq: 190, freq2: 62, dur: 0.12, gain: 0.32 });
  },
  flip() {
    noise({ dur: 0.05, f0: 6200, f1: 3200, q: 1.3, gain: 0.18 });
    tone({ freq: 900, freq2: 1300, dur: 0.04, gain: 0.04, type: "triangle" });
  },
  pick() {
    tone({ freq: 480, freq2: 720, dur: 0.07, gain: 0.1, type: "triangle" });
  },
  drop() {
    tone({ freq: 320, freq2: 180, dur: 0.07, gain: 0.08, type: "triangle" });
  },
  chime(step: number) {
    const s = SCALE[Math.min(SCALE.length - 1, Math.max(0, step))];
    const f = noteHz(s);
    tone({ freq: f, dur: 0.55, gain: 0.22, type: "triangle" });
    tone({ freq: f * 2, dur: 0.4, gain: 0.07, type: "sine", delay: 0.012 });
    tone({ freq: f * 3.01, dur: 0.25, gain: 0.035, type: "sine", delay: 0.02 });
  },
  complete() {
    [0, 4, 7, 12, 16, 19].forEach((s, i) => {
      tone({ freq: noteHz(s, 659.25), dur: 0.7, gain: 0.16, type: "triangle", delay: i * 0.07 });
      tone({ freq: noteHz(s, 659.25) * 2, dur: 0.5, gain: 0.05, type: "sine", delay: i * 0.07 });
    });
  },
  error() {
    tone({ freq: 150, freq2: 92, dur: 0.17, gain: 0.13, type: "sawtooth" });
    tone({ freq: 148, freq2: 90, dur: 0.17, gain: 0.07, type: "square", delay: 0.01 });
  },
  undo() {
    tone({ freq: 700, freq2: 300, dur: 0.14, gain: 0.12, type: "triangle" });
    noise({ dur: 0.12, f0: 2000, f1: 600, q: 0.7, gain: 0.12 });
  },
  hint() {
    tone({ freq: 880, dur: 0.25, gain: 0.1, type: "sine" });
    tone({ freq: 1320, dur: 0.3, gain: 0.08, type: "sine", delay: 0.09 });
  },
  whoosh(up = true) {
    noise({ dur: 0.55, f0: up ? 250 : 3600, f1: up ? 3600 : 250, q: 0.7, gain: 0.26, rate: 0.7 });
  },
  ui() {
    tone({ freq: 820, freq2: 640, dur: 0.045, gain: 0.07, type: "triangle" });
  },
  win() {
    const seq = [0, 4, 7, 12, 16, 19, 24, 28];
    seq.forEach((s, i) => {
      tone({ freq: noteHz(s, 523.25), dur: 0.9, gain: 0.17, type: "triangle", delay: i * 0.1 });
      tone({ freq: noteHz(s, 523.25) * 2, dur: 0.7, gain: 0.05, type: "sine", delay: i * 0.1 });
    });
    [0, 4, 7, 12].forEach((s) => tone({ freq: noteHz(s, 261.63), dur: 1.8, gain: 0.12, type: "sawtooth", delay: 0.9, attack: 0.05 }));
    noise({ dur: 1.2, f0: 800, f1: 6000, q: 0.5, gain: 0.12, delay: 0.1 });
  },
  stuck() {
    [0, -3, -7, -12].forEach((s, i) => tone({ freq: noteHz(s, 392), dur: 0.45, gain: 0.13, type: "triangle", delay: i * 0.16 }));
  },
  start() {
    noise({ dur: 0.9, f0: 200, f1: 5000, q: 0.6, gain: 0.2, rate: 0.6 });
    tone({ freq: 110, freq2: 220, dur: 0.9, gain: 0.12, type: "sawtooth", attack: 0.3 });
    [0, 7, 12].forEach((s, i) => tone({ freq: noteHz(s, 392), dur: 0.8, gain: 0.1, type: "triangle", delay: 0.55 + i * 0.07 }));
  },
};

export function vibrate(ms: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}
