/**
 * A message in flight: a labelled pill moving from (x1,y1) to (x2,y2) between
 * `sentAt` and `arriveAt`. Draw packets *before* the nodes they connect, so a
 * pill slides out from under one card and into the next instead of covering text.
 * Keep labels short (≤ ~10 chars): gaps between cards are often under 100 units.
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
}) {
  const f = Math.min(1, Math.max(0, (now - sentAt) / (arriveAt - sentAt)));
  const x = x1 + (x2 - x1) * f;
  const y = y1 + (y2 - y1) * f;
  const w = Math.max(34, label.length * 8.2 + 18); // ~0.6em per mono char at svg-body
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <rect x={-w / 2} y={-11} width={w} height={22} rx={11} className="fill-bg" stroke={color} strokeWidth={1.5} />
      <text textAnchor="middle" dy={4.5} className="font-mono text-svg-body" fill={color}>
        {label}
      </text>
    </g>
  );
}
