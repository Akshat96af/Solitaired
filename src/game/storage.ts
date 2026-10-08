export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  seconds: number;
  moves: number;
  date: number;
  draw: 1 | 3;
  won: boolean;
  daily: boolean;
}

export interface Settings {
  sound: boolean;
  shake: boolean;
  draw: 1 | 3;
  name: string;
}

export interface Stats {
  played: number;
  won: number;
  bestStreak: number;
  streak: number;
}

const HS_KEY = "royal-solitaire:scores:v1";
const SET_KEY = "royal-solitaire:settings:v1";
const STAT_KEY = "royal-solitaire:stats:v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function loadScores(): ScoreEntry[] {
  const list = read<unknown>(HS_KEY, []);
  return Array.isArray(list) ? sortScores(list.filter(isScore)) : [];
}

const nonNegative = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function isScore(v: unknown): v is ScoreEntry {
  return record(v) && typeof v.id === "string" && typeof v.name === "string" &&
    nonNegative(v.score) && nonNegative(v.seconds) && nonNegative(v.moves) && nonNegative(v.date) &&
    (v.draw === 1 || v.draw === 3) && typeof v.won === "boolean" && typeof v.daily === "boolean";
}

function sortScores(list: ScoreEntry[]): ScoreEntry[] {
  return list
    .slice()
    .sort((a, b) => b.score - a.score || a.seconds - b.seconds || a.date - b.date)
    .slice(0, 10);
}

export function addScore(entry: Omit<ScoreEntry, "id">): { list: ScoreEntry[]; entry: ScoreEntry; rank: number } {
  const full: ScoreEntry = { ...entry, id: `${entry.date}-${Math.floor(Math.random() * 1e6)}` };
  const list = sortScores([...loadScores(), full]);
  const rank = list.findIndex((e) => e.id === full.id);
  write(HS_KEY, list);
  return { list, entry: full, rank: rank >= 0 ? rank + 1 : -1 };
}

export function renameScore(id: string, name: string): ScoreEntry[] {
  const list = loadScores().map((e) => (e.id === id ? { ...e, name } : e));
  write(HS_KEY, list);
  return list;
}

export function clearScores() {
  write(HS_KEY, []);
}

export function bestScore(): number {
  const l = loadScores();
  return l.length ? l[0].score : 0;
}

export function loadSettings(): Settings {
  const raw = read<unknown>(SET_KEY, {});
  const s = record(raw) ? raw : {};
  return {
    sound: typeof s.sound === "boolean" ? s.sound : true,
    shake: typeof s.shake === "boolean" ? s.shake : true,
    draw: s.draw === 3 ? 3 : 1,
    name: typeof s.name === "string" && s.name.trim() ? s.name.trim().slice(0, 24) : "PLAYER",
  };
}

export function saveSettings(s: Settings) {
  write(SET_KEY, s);
}

export function loadStats(): Stats {
  const raw = read<unknown>(STAT_KEY, {});
  const s = record(raw) ? raw : {};
  const played = nonNegative(s.played) ? s.played : 0;
  const won = Math.min(played, nonNegative(s.won) ? s.won : 0);
  const bestStreak = Math.min(won, nonNegative(s.bestStreak) ? s.bestStreak : 0);
  const streak = Math.min(bestStreak, nonNegative(s.streak) ? s.streak : 0);
  return { played, won, bestStreak, streak };
}

export function saveStats(s: Stats) {
  write(STAT_KEY, s);
}
