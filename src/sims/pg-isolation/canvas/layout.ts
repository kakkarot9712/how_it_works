// Layout in SVG user units, legible at the default (fit) zoom on a 1280×800 screen.
// Top-left stays clear for the zoom controls. Sessions on the left, the postgres server
// (one backend per session, then shared memory: the table, pg_xact, the lock table) on the right.
export const W = 1160;
export const H = 760;
export const SESS = { x: 8, w: 504, h: 308 };
/** Session card tops. */
export const SESS_TOP: Record<"A" | "B", number> = { A: 128, B: 448 };
/** The y each session's wire and packets run along. */
export const WIRE_Y: Record<"A" | "B", number> = { A: 128 + 128, B: 448 + 128 };
export const SERVER = { x: 636, y: 12, w: 516, h: 736 };
export const BE = { x: 652, w: 156, h: 164 };
export const HEAP = { x: 822, y: 52, w: 318, h: 330 };
export const XACT = { x: 822, y: 394, w: 318, h: 132 };
export const LOCKS = { x: 822, y: 538, w: 318, h: 198 };

/**
 * The open gap each kind of packet crosses (SVG units): session card → backend.
 * src/sims/lanes.test.ts checks every label the scenarios produce fits with LANE_MARGIN to spare.
 */
const SESSION_GAP = BE.x - (SESS.x + SESS.w);
export const LANE_GAP: Record<string, number> = { stmt: SESSION_GAP, reply: SESSION_GAP };
