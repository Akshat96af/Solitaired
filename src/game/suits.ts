// Suit geometry in a 100x100 box. Subpath winding is consistent so a nonzero
// fill rule unions overlapping shapes (important for the club).
export const SUIT_PATHS: string[] = [
  // spade
  "M50 4 C62 22 92 40 92 62 C92 77 80 86 68 86 C60 86 54 82 51 76 C51 86 54 93 62 97 L38 97 C46 93 49 86 49 76 C46 82 40 86 32 86 C20 86 8 77 8 62 C8 40 38 22 50 4 Z",
  // heart
  "M50 95 C20 72 6 52 6 33 C6 18 17 8 30 8 C39 8 46 13 50 21 C54 13 61 8 70 8 C83 8 94 18 94 33 C94 52 80 72 50 95 Z",
  // diamond
  "M50 3 C56 22 72 40 90 50 C72 60 56 78 50 97 C44 78 28 60 10 50 C28 40 44 22 50 3 Z",
  // club (three lobes + stem, all counter-clockwise)
  "M29 29 a21 21 0 1 0 42 0 a21 21 0 1 0 -42 0 Z M6 62 a21 21 0 1 0 42 0 a21 21 0 1 0 -42 0 Z M52 62 a21 21 0 1 0 42 0 a21 21 0 1 0 -42 0 Z M38 55 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 Z M44 56 C44 76 40 88 32 97 L68 97 C60 88 56 76 56 56 Z",
];

let path2d: Path2D[] | null = null;
export function suitPath2D(suit: number): Path2D {
  if (!path2d) path2d = SUIT_PATHS.map((d) => new Path2D(d));
  return path2d[suit];
}

export const SUIT_COLOR_RED = "#c8102e";
export const SUIT_COLOR_BLACK = "#16181d";
