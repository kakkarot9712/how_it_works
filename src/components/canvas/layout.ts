/** Centre lines for `n` evenly spaced rows between `top` and `bottom` (SVG units). */
export function rows(n: number, top: number, bottom: number): number[] {
  if (n === 1) return [(top + bottom) / 2];
  const gap = (bottom - top) / n;
  return Array.from({ length: n }, (_, i) => top + gap * (i + 0.5));
}

/**
 * Width of a Packet pill for `label` (SVG units, ~0.6em per mono char at svg-body).
 * A pill must fit inside the gap it crosses, with margin: see `LANE_GAP` in each sim's
 * canvas/layout.ts and src/sims/lanes.test.ts.
 */
export function packetWidth(label: string): number {
  return Math.max(34, label.length * 8.2 + 18);
}

/** Height of a Packet pill (SVG units). */
export const PACKET_H = 22;

/**
 * How far a packet lane sits from the wire it runs along: half a pill, half a highlighted
 * wire, and 5 units of clear space. Use ±PACKET_LANE for the lanes next to a wire, and
 * ±(PACKET_LANE + PACKET_H + 5) for a second lane on the same side.
 */
export const PACKET_LANE = 18;
export const PACKET_LANE_2 = PACKET_LANE + PACKET_H + 5;

/** Clear space a pill needs on each side, inside its gap. */
export const LANE_MARGIN = 12;

export { secs } from "@/lib/format";
