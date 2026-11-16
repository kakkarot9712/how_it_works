// Layout in SVG user units. Text sizes are chosen for the default (fit) zoom
// on a ~1100px wide canvas; users can zoom in further. Top-left stays clear for zoom controls.
export const W = 1160;
export const H = 760;
export const PROD = { x: 8, y: 132, w: 150, h: 164 };
export const PROC = { x: 260, y: 12, w: 562, h: H - 24 };
export const STREAM = { x: 276, y: 52, w: 530, h: 206 };
export const GROUPS: Record<string, { x: number; y: number; w: number; h: number }> = {
  mailers: { x: 276, y: 272, w: 530, h: 262 },
  analytics: { x: 276, y: 548, w: 530, h: 186 },
};
export const CONS = { x: 936, w: 216, h: 128 };
/** Consumer card centres. */
export const CONS_Y: Record<string, number> = { C1: 334, C2: 472, C3: 641 };
/** Cells shown on the stream tape (newest at the right). */
export const TAPE_CELLS = 12;

/**
 * The open gap each kind of packet crosses (SVG units). Every pill on a lane must fit
 * inside it with LANE_MARGIN to spare, so moving labels never slide under a card's text.
 * src/sims/lanes.test.ts checks this against every label the scenarios produce.
 */
const PRODUCER_GAP = STREAM.x - (PROD.x + PROD.w);
const CONSUMER_GAP = CONS.x - (STREAM.x + STREAM.w);
export const LANE_GAP: Record<string, number> = {
  xadd: PRODUCER_GAP,
  reply: PRODUCER_GAP,
  read: CONSUMER_GAP,
  entries: CONSUMER_GAP,
  ack: CONSUMER_GAP,
  claim: CONSUMER_GAP,
  claimed: CONSUMER_GAP,
  dlq: CONSUMER_GAP,
};
