import { rows } from "@/components/canvas";

// SVG user units. Producer on the left, the three brokers stacked in the middle (one row
// each, logs aligned by offset), the replication lanes on the right (one vertical lane per
// follower, carrying its fetches), and the controller as a strip along the top. The
// top-left corner stays free for the zoom controls.
export const W = 1160;
export const H = 760;

export const CTL = { x: 290, y: 8, w: 862, h: 86 };
export const PROD = { x: 8, y: 128, w: 170, h: H - 136 };
export const BRK = { x: 290, w: 520, h: 196 };
/** Broker row centres: broker-1, broker-2, broker-3. */
export const BRK_Y = rows(3, 106, H - 8);

/** Replication lanes: one per broker, to the right of the broker cards. */
export const LANES_X0 = BRK.x + BRK.w + 10;
export const LANE_W = (W - 8 - LANES_X0) / 3;
export const laneX = (b: 1 | 2 | 3) => LANES_X0 + LANE_W * (b - 0.5);

/** Offsets shown on each broker's tape (the newest, aligned across brokers). */
export const TAPE_CELLS = 20;

/**
 * The open gap each packet kind crosses (SVG units): produce traffic crosses between the
 * producer and the broker cards; fetch traffic runs up and down its own lane, so its pill
 * must fit the lane's width. src/sims/lanes.test.ts checks every label against these.
 */
const PRODUCE_GAP = BRK.x - (PROD.x + PROD.w);
export const LANE_GAP: Record<string, number> = {
  produce: PRODUCE_GAP,
  "produce-resp": PRODUCE_GAP,
  fetch: LANE_W,
  "fetch-resp": LANE_W,
};
