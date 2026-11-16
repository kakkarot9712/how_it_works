"use client";

import { UNFOCUSED_OPACITY, useFocus } from "./Focus";
import { PACKET_H, packetWidth } from "./layout";

/**
 * A message in flight: a labelled pill moving from (x1,y1) to (x2,y2) between
 * `sentAt` and `arriveAt`. Draw packets *before* the nodes they connect, so a
 * pill slides out from under one card and into the next instead of covering text.
 * Keep labels short (≤ ~10 chars). Every pill must fit its gap with margin: each sim's
 * `LANE_GAP` (canvas/layout.ts) is checked against real labels by src/sims/lanes.test.ts.
 */
export function Packet({
  x1,
  y1,
  x2,
  y2,
  sentAt,
  arriveAt,
  now,
  label,
  color,
  ends,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sentAt: number;
  arriveAt: number;
  now: number;
  label: string;
  /** A CSS colour, e.g. a channel colour or toneColor.err. */
  color: string;
  /** Sender and receiver node ids, so the flow spotlight can dim messages outside it. */
  ends?: [string, string];
}) {
  const focus = useFocus(ends);
  const f = Math.min(1, Math.max(0, (now - sentAt) / (arriveAt - sentAt)));
  const x = x1 + (x2 - x1) * f;
  const y = y1 + (y2 - y1) * f;
  const w = packetWidth(label);
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none" opacity={focus === "off" ? UNFOCUSED_OPACITY : 1}>
      <rect x={-w / 2} y={-PACKET_H / 2} width={w} height={PACKET_H} rx={PACKET_H / 2} className="fill-bg" stroke={color} strokeWidth={1.5} />
      <text textAnchor="middle" dy={4.5} className="font-mono text-svg-body" fill={color}>
        {label}
      </text>
    </g>
  );
}
