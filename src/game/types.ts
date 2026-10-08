export type Suit = 0 | 1 | 2 | 3; // 0 spades, 1 hearts, 2 diamonds, 3 clubs

export interface Card {
  id: number; // suit * 13 + (rank - 1)
  suit: Suit;
  rank: number; // 1 (Ace) .. 13 (King)
  up: boolean;
}

export type PileType = "stock" | "waste" | "foundation" | "tableau";

export interface PileRef {
  type: PileType;
  index: number;
}

export interface Game {
  stock: Card[]; // top = last element
  waste: Card[]; // top = last element
  foundations: Card[][];
  tableau: Card[][];
  fan: number; // number of waste cards currently fanned out (draw-3)
  score: number;
  moves: number;
  recycles: number;
  drawCount: 1 | 3;
  seed: number;
}

export interface Move {
  from: PileRef;
  to: PileRef;
  count: number;
}

export interface Selection {
  from: PileRef;
  count: number;
}

export interface Hint {
  from: PileRef;
  count: number;
  to: PileRef | null; // null => draw from stock
}

export interface Cursor {
  pile: PileRef;
  depth: number; // 0 = top card of the pile, 1 = one below, ...
}

export const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"] as const;
export const RANK_LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const isRed = (s: Suit): boolean => s === 1 || s === 2;
export const samePile = (a: PileRef, b: PileRef): boolean => a.type === b.type && a.index === b.index;
export const pileKey = (p: PileRef): string => `${p.type}${p.index}`;
