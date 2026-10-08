import { memo } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Suit } from "../game/types";
import { CardFace } from "./CardFace";

export function cardTransform(x: number, y: number, rot: number): string {
  return `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;
}

export interface CardViewProps {
  id: number;
  suit: Suit;
  rank: number;
  up: boolean;
  x: number;
  y: number;
  z: number;
  rot: number;
  cw: number;
  ch: number;
  radius: number;
  dur: number;
  delay: number;
  flipDelay: number;
  dragging: boolean;
  selected: boolean;
  hint: boolean;
  fly: boolean;
  grab: boolean;
  onDown: (e: ReactPointerEvent<HTMLDivElement>, id: number) => void;
}

export const CardView = memo(function CardView(p: CardViewProps) {
  const style: CSSProperties = {
    width: p.cw,
    height: p.ch,
    borderRadius: p.radius,
    transform: cardTransform(p.x, p.y, p.rot),
    zIndex: p.z,
    transition: p.dragging ? "none" : `transform ${p.dur}ms cubic-bezier(0.2, 0.85, 0.25, 1) ${p.delay}ms`,
  };
  return (
    <div
      className="card-pos"
      data-id={p.id}
      data-drag={p.grab ? 1 : 0}
      data-lift={p.dragging ? 1 : 0}
      data-sel={p.selected ? 1 : 0}
      data-hint={p.hint ? 1 : 0}
      data-fly={p.fly ? 1 : 0}
      style={style}
      onPointerDown={(e) => p.onDown(e, p.id)}
    >
      <div className="card-land" style={{ borderRadius: p.radius }}>
        <div
          className="card-flip"
          style={{
            borderRadius: p.radius,
            transform: p.up ? "perspective(900px) rotateY(0deg)" : "perspective(900px) rotateY(180deg)",
            transitionDelay: `${p.flipDelay}ms`,
          }}
        >
          <div className="card-face" style={{ borderRadius: p.radius }}>
            <CardFace suit={p.suit} rank={p.rank} />
          </div>
          <div className="card-back" style={{ borderRadius: p.radius }} />
        </div>
      </div>
    </div>
  );
});
