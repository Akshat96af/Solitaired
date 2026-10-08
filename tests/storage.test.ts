// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadScores, loadSettings, loadStats, saveSettings } from "../src/game/storage";

beforeEach(() => localStorage.clear());
describe("corrupt and unavailable storage", () => {
  it.each(["null", "[]", "42", '"bad"', "{broken"])("loads safe defaults from %s", raw => {
    for (const kind of ["settings", "stats", "scores"]) localStorage.setItem(`royal-solitaire:${kind}:v1`, raw);
    expect(loadSettings()).toEqual({ sound: true, shake: true, draw: 1, name: "PLAYER" });
    expect(loadStats()).toEqual({ played: 0, won: 0, bestStreak: 0, streak: 0 });
    expect(loadScores()).toEqual([]);
  });
  it("validates field types and filters invalid leaderboard rows", () => {
    localStorage.setItem("royal-solitaire:settings:v1", JSON.stringify({ sound: "false", shake: 0, name: "  ", draw: 7 }));
    localStorage.setItem("royal-solitaire:stats:v1", JSON.stringify({ played: -1, won: "20", streak: 999 }));
    localStorage.setItem("royal-solitaire:scores:v1", JSON.stringify([null, {}, { score: "99" }]));
    expect(loadSettings().sound).toBe(true);
    expect(loadSettings().name).toBe("PLAYER");
    expect(loadStats().won).toBe(0);
    expect(loadScores()).toEqual([]);
  });
  it("keeps playing when browser storage is blocked", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => saveSettings(loadSettings())).not.toThrow();
    get.mockRestore(); set.mockRestore();
  });
});
