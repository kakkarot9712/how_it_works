/** Centre lines for `n` evenly spaced rows between `top` and `bottom` (SVG units). */
export function rows(n: number, top: number, bottom: number): number[] {
  if (n === 1) return [(top + bottom) / 2];
  const gap = (bottom - top) / n;
  return Array.from({ length: n }, (_, i) => top + gap * (i + 0.5));
}

export { secs } from "@/lib/format";
