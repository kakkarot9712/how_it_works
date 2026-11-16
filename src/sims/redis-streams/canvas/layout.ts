// Layout in SVG user units. Text sizes are chosen for the default (fit) zoom
// on a ~1100px wide canvas; users can zoom in further. Top-left stays clear for zoom controls.
export const W = 1160;
export const H = 760;
export const PROD = { x: 8, y: 132, w: 186, h: 164 };
export const PROC = { x: 216, y: 12, w: 594, h: H - 24 };
export const STREAM = { x: 232, y: 52, w: 562, h: 206 };
export const GROUPS: Record<string, { x: number; y: number; w: number; h: number }> = {
  mailers: { x: 232, y: 272, w: 562, h: 262 },
  analytics: { x: 232, y: 548, w: 562, h: 186 },
};
export const CONS = { x: 900, w: 252, h: 128 };
/** Consumer card centres. */
export const CONS_Y: Record<string, number> = { C1: 334, C2: 472, C3: 641 };
/** Cells shown on the stream tape (newest at the right). */
export const TAPE_CELLS = 12;
