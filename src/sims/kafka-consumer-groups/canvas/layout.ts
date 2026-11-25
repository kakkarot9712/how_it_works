import { PACKET_LANE, PACKET_LANE_2 } from "@/components/canvas";

// SVG user units. Producer on the left, the three partitions of `orders` stacked in the
// middle with the group coordinator below them, the four consumers on the right. Partitions
// and the coordinator are on brokers; consumers pull from the partitions and heartbeat and
// commit to the coordinator across the same gap. The top-left corner stays free for the
// zoom controls.
export const W = 1160;
export const H = 760;

export const PROD = { x: 8, y: 130, w: 160, h: H - 138 };
export const PART = { x: 290, w: 360, h: 168 };
export const PART_TOP = [8, 194, 380];
export const COORD_BOX = { x: 290, y: 566, w: 360, h: 186 };
export const CONS = { x: 800, w: 352, h: 176 };
export const CONS_TOP = [8, 196, 384, 572];

/** Offsets shown on each partition's tape (the newest). */
export const TAPE_CELLS = 12;

export const partMidY = (p: number) => PART_TOP[p] + PART.h / 2;
export const consTop = (c: number) => CONS_TOP[c - 1];
/** Where a consumer's fetch wire and its coordinator wire leave its card. */
export const consFetchY = (c: number) => consTop(c) + 40;
export const consCoordY = (c: number) => consTop(c) + 136;
/** Where each consumer's wire meets the coordinator, spread down its right edge. */
export const coordPortY = (c: number) => COORD_BOX.y + 54 + (c - 1) * 32;
/** Where the producer's wire to a partition leaves the producer card. */
export const prodPortY = (p: number) => Math.max(PROD.y + 24 + p * 30, partMidY(p));

export const LANE = { request: -PACKET_LANE, response: PACKET_LANE, commit: -PACKET_LANE_2, commitResp: PACKET_LANE_2 };

/**
 * The open gap each packet kind crosses (SVG units). src/sims/lanes.test.ts checks every
 * label against these.
 */
const PRODUCE_GAP = PART.x - (PROD.x + PROD.w);
const CONSUMER_GAP = CONS.x - (PART.x + PART.w);
export const LANE_GAP: Record<string, number> = {
  produce: PRODUCE_GAP,
  fetch: CONSUMER_GAP,
  "fetch-resp": CONSUMER_GAP,
  hb: CONSUMER_GAP,
  "hb-resp": CONSUMER_GAP,
  commit: CONSUMER_GAP,
  "commit-resp": CONSUMER_GAP,
};
