import { memo } from "react";
import { RANK_LABELS, isRed } from "../game/types";
import type { Suit } from "../game/types";
import { SUIT_COLOR_BLACK, SUIT_COLOR_RED, SUIT_PATHS } from "../game/suits";

/** Hidden <defs> shared by every card (suit symbols + gradients). Render once. */
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        {SUIT_PATHS.map((d, i) => (
          <symbol key={i} id={`suit-${i}`} viewBox="0 0 100 100">
            <path d={d} />
          </symbol>
        ))}
        <linearGradient id="gold-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbe9a0" />
          <stop offset="0.55" stopColor="#d9a62e" />
          <stop offset="1" stopColor="#9a6a10" />
        </linearGradient>
        <linearGradient id="fc-r" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1f2" />
          <stop offset="1" stopColor="#f6c5cc" />
        </linearGradient>
        <linearGradient id="fc-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1f3f8" />
          <stop offset="1" stopColor="#c6cedf" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const PIPS: Record<number, [number, number][]> = {
  2: [[50, 34], [50, 106]],
  3: [[50, 34], [50, 70], [50, 106]],
  4: [[34, 34], [66, 34], [34, 106], [66, 106]],
  5: [[34, 34], [66, 34], [50, 70], [34, 106], [66, 106]],
  6: [[34, 34], [66, 34], [34, 70], [66, 70], [34, 106], [66, 106]],
  7: [[34, 34], [66, 34], [50, 52], [34, 70], [66, 70], [34, 106], [66, 106]],
  8: [[34, 34], [66, 34], [50, 52], [34, 70], [66, 70], [50, 88], [34, 106], [66, 106]],
  9: [[34, 34], [66, 34], [34, 58], [66, 58], [50, 70], [34, 82], [66, 82], [34, 106], [66, 106]],
  10: [[34, 34], [66, 34], [50, 46], [34, 58], [66, 58], [34, 82], [66, 82], [50, 94], [34, 106], [66, 106]],
};

function Crown({ rank }: { rank: number }) {
  if (rank === 13) {
    // King: three-point crown
    return (
      <g>
        <path d="M-13 7 L-15 -6 L-7 0 L0 -9 L7 0 L15 -6 L13 7 Z" fill="url(#gold-g)" stroke="#7a5208" strokeWidth="0.6" />
        <path d="M-13 7 H13 V11 H-13 Z" fill="url(#gold-g)" stroke="#7a5208" strokeWidth="0.6" />
        <circle cx="-15" cy="-6" r="1.9" fill="#fff4c4" />
        <circle cx="0" cy="-9" r="2.2" fill="#fff4c4" />
        <circle cx="15" cy="-6" r="1.9" fill="#fff4c4" />
        <circle cx="0" cy="3" r="1.6" fill="#b3122f" />
      </g>
    );
  }
  if (rank === 12) {
    // Queen: tiara with pearls
    return (
      <g>
        <path d="M-13 8 Q0 1 13 8 L13 11.5 Q0 5 -13 11.5 Z" fill="url(#gold-g)" stroke="#7a5208" strokeWidth="0.6" />
        {[-11, -5.5, 0, 5.5, 11].map((x, i) => {
          const y = [0, -4, -7, -4, 0][i];
          return (
            <g key={x}>
              <line x1={x} y1={y + 2} x2={x} y2={7 - Math.abs(x) * 0.12} stroke="#b8861b" strokeWidth="1" />
              <circle cx={x} cy={y} r={i === 2 ? 2.6 : 2} fill="#fff4c4" stroke="#b8861b" strokeWidth="0.5" />
            </g>
          );
        })}
      </g>
    );
  }
  // Jack: heraldic shield
  return (
    <g>
      <path d="M-9 -8 H9 V2 C9 8 0 12 0 12 C0 12 -9 8 -9 2 Z" fill="url(#gold-g)" stroke="#7a5208" strokeWidth="0.7" />
      <path d="M-5.5 -5 H5.5 V2 C5.5 5.5 0 8.5 0 8.5 C0 8.5 -5.5 5.5 -5.5 2 Z" fill="#fff4c4" opacity="0.55" />
      <path d="M0 -4 V6 M-4 0 H4" stroke="#8a5d0b" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  );
}

function Index({ label, suit, color }: { label: string; suit: Suit; color: string }) {
  return (
    <g fill={color}>
      <text
        x="17"
        y="25"
        textAnchor="middle"
        fontSize={label === "10" ? 21 : 25}
        fontWeight="800"
        letterSpacing={label === "10" ? -1.5 : 0}
        fontFamily='"Playfair Display", Georgia, serif'
      >
        {label}
      </text>
      <use href={`#suit-${suit}`} x="9" y="29" width="16" height="16" />
    </g>
  );
}

export const CardFace = memo(function CardFace({ suit, rank }: { suit: Suit; rank: number }) {
  const red = isRed(suit);
  const color = red ? SUIT_COLOR_RED : SUIT_COLOR_BLACK;
  const label = RANK_LABELS[rank];
  const pips = PIPS[rank];
  const face = rank >= 11;

  const half = (
    <g>
      <g transform="translate(50 39)">
        <Crown rank={rank} />
      </g>
      <use href={`#suit-${suit}`} x="39" y="48" width="22" height="22" fill={color} />
    </g>
  );

  return (
    <svg viewBox="0 0 100 140" width="100%" height="100%" preserveAspectRatio="none" style={{ display: "block" }}>
      <rect x="3.5" y="3.5" width="93" height="133" rx="6" fill="none" stroke="rgba(120,90,30,0.16)" strokeWidth="1" />
      <Index label={label} suit={suit} color={color} />
      <g transform="rotate(180 50 70)">
        <Index label={label} suit={suit} color={color} />
      </g>

      {rank === 1 && (
        <g>
          <circle cx="50" cy="70" r="30" fill="none" stroke={color} strokeWidth="0.8" opacity="0.18" />
          <use href={`#suit-${suit}`} x="26" y="46" width="48" height="48" fill={color} />
        </g>
      )}

      {pips &&
        pips.map(([x, y], i) => (
          <use
            key={i}
            href={`#suit-${suit}`}
            x={x - 9.5}
            y={y - 9.5}
            width="19"
            height="19"
            fill={color}
            transform={y > 70 ? `rotate(180 ${x} ${y})` : undefined}
          />
        ))}

      {face && (
        <g>
          <rect x="25" y="27" width="50" height="86" rx="3" fill={`url(#fc-${red ? "r" : "b"})`} stroke="#b8891f" strokeWidth="1.2" />
          <rect x="28.5" y="30.5" width="43" height="79" rx="2" fill="none" stroke="#b8891f" strokeWidth="0.5" opacity="0.7" />
          <text
            x="50"
            y="92"
            textAnchor="middle"
            fontSize="66"
            fontWeight="900"
            fontFamily='"Playfair Display", Georgia, serif'
            fill={color}
            opacity="0.09"
          >
            {label}
          </text>
          {half}
          <g transform="rotate(180 50 70)">{half}</g>
          <line x1="29" y1="70" x2="71" y2="70" stroke="#b8891f" strokeWidth="0.6" />
          <path d="M50 66.2 L53.8 70 L50 73.8 L46.2 70 Z" fill="url(#gold-g)" stroke="#7a5208" strokeWidth="0.4" />
        </g>
      )}
    </svg>
  );
});
