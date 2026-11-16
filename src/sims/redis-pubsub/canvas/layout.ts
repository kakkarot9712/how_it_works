// Layout in SVG user units. Text sizes are chosen for the default (fit) zoom
// on a ~1100px wide canvas; users can zoom in further.
export const W = 1160;
export const H = 760;
export const PUB = { x: 8, w: 190, h: 124 };
export const PROC = { x: 300, y: 12, w: 520, h: H - 24 };
// Tall enough to span every output buffer row, so core → buffer wires run straight across.
export const CORE = { x: 318, w: 236, y: 96, h: 568 };
export const BUF = { x: 584, w: 214, h: 112 };
export const SUB = { x: 930, w: 226, h: 206 };

/**
 * The open gap each kind of packet crosses (SVG units). Every pill on a lane must fit
 * inside it with LANE_MARGIN to spare, so moving labels never slide under a card's text.
 * src/sims/lanes.test.ts checks this against every label the scenarios produce.
 */
const PUBLISH_GAP = CORE.x - (PUB.x + PUB.w);
const DELIVER_GAP = SUB.x - (BUF.x + BUF.w);
export const LANE_GAP: Record<string, number> = {
  publish: PUBLISH_GAP,
  reply: PUBLISH_GAP,
  deliver: DELIVER_GAP,
  fin: DELIVER_GAP,
  subscribe: DELIVER_GAP,
};
