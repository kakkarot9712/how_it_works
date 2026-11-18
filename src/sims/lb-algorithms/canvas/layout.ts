import { rows } from "@/components/canvas";

// Layout in SVG user units. Four lanes (one nginx upstream group each) stacked
// vertically; clients on the left feed all of them. Text sizes are for the default
// (fit) zoom on a ~1100px wide canvas.
export const W = 1160;
export const H = 760;

/** Lane centre lines: one row per balancing method. */
export const LANE_Y = rows(4, 34, H - 6);

/** The clients card spans every lane so its wires run straight across. The top-left corner stays free for the zoom controls. */
export const CLI = { x: 8, y: 98, w: 150, h: H - 104 };
export const LB = { x: 262, w: 236, h: 166 };
export const SRV = { x: 652, w: 500, h: 50 };
/** Server rows relative to the lane centre. */
export const SRV_DY = [-57, 0, 57];

/**
 * The open gap each kind of packet crosses (SVG units). Every pill must fit with
 * LANE_MARGIN to spare; src/sims/lanes.test.ts checks it against every label.
 */
const CLIENT_GAP = LB.x - (CLI.x + CLI.w);
const UPSTREAM_GAP = SRV.x - (LB.x + LB.w);
export const LANE_GAP: Record<string, number> = {
  req: CLIENT_GAP,
  fwd: UPSTREAM_GAP,
  resp: UPSTREAM_GAP,
  rst: UPSTREAM_GAP,
};
