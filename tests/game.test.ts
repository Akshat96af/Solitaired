import { describe, expect, it } from "vitest";
import { applyMove, deal, drawFromStock, findHint, isLegalMove, isWon, makeCard, planAutoFinish } from "../src/game/rules";
import { smoothing } from "../src/fx/motion";
import type { Game } from "../src/game/types";

function assertDeck(game: Game) {
  const cards = [...game.stock, ...game.waste, ...game.tableau.flat(), ...game.foundations.flat()];
  expect(cards).toHaveLength(52);
  expect(new Set(cards.map(c => c.id)).size).toBe(52);
  expect(game.stock.every(c => !c.up)).toBe(true);
  expect(game.waste.every(c => c.up)).toBe(true);
}

describe("game invariants", () => {
  it("reproduces a seed and deals 52 unique cards", () => {
    for (let seed = 0; seed < 50; seed++) {
      const g = deal(seed, 1);
      expect(g).toEqual(deal(seed, 1));
      expect(g.tableau.map(t => t.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      assertDeck(g);
    }
  });
  it.each([1, 3] as const)("preserves the deck and input through draw-%i moves and recycling", draw => {
    for (let seed = 1; seed <= 12; seed++) {
      let g = deal(seed, draw);
      for (let step = 0; step < 120; step++) {
        const before = structuredClone(g);
        const h = findHint(g);
        const result = h?.to ? applyMove(g, { from: h.from, to: h.to, count: h.count }) : drawFromStock(g);
        expect(g).toEqual(before);
        if (!result) break;
        g = result.game;
        assertDeck(g);
        expect(g.score).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("rejects an illegal stock move without changing state", () => {
    const g = deal(42, 1);
    const before = structuredClone(g);
    expect(applyMove(g, { from: { type: "stock", index: 0 }, to: { type: "foundation", index: 0 }, count: 1 })).toBeNull();
    expect(g).toEqual(before);
  });
  it("plans a legal complete finish without mutating the game", () => {
    const g = deal(1, 1);
    g.stock = []; g.waste = []; g.tableau = Array.from({ length: 7 }, () => []);
    g.foundations = Array.from({ length: 4 }, (_, suit) => Array.from({ length: 12 }, (_, rank) => makeCard(suit * 13 + rank, true)));
    for (let suit = 0; suit < 4; suit++) g.tableau[suit].push(makeCard(suit * 13 + 12, true));
    const before = structuredClone(g);
    const plan = planAutoFinish(g)!;
    expect(plan).toHaveLength(4);
    expect(g).toEqual(before);
    let cur = g;
    for (const step of plan) {
      if (step.kind === "move") {
        expect(isLegalMove(cur, step.move)).toBe(true);
        cur = applyMove(cur, step.move)!.game;
      }
    }
    expect(isWon(cur)).toBe(true);
    assertDeck(cur);
  });
  it("settles equally over the same duration at 60, 120 and 144 Hz", () => {
    const sample = (hz: number) => {
      let value = 0;
      for (let n = 0; n < hz; n++) value += (1 - value) * smoothing(1 / hz);
      return value;
    };
    expect(sample(60)).toBeCloseTo(sample(120), 12);
    expect(sample(120)).toBeCloseTo(sample(144), 12);
  });
});
