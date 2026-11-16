import { cx } from "@/lib/cx";

/** A connection between two points. `broken` draws it dashed red with a ✕ in the middle (a cut network link). */
export function Wire({
  x1,
  y1,
  x2,
  y2,
  curve,
  broken,
  faded,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Draw an S-curve (horizontal tangents at both ends) instead of a straight line. */
  curve?: boolean;
  broken?: boolean;
  /** De-emphasise (e.g. an unregistered subscription). */
  faded?: boolean;
}) {
  const cls = cx(broken ? "stroke-err" : faded ? "stroke-line/30" : "stroke-line");
  const d = curve
    ? `M${x1} ${y1} C ${x1 + 16} ${y1}, ${x2 - 16} ${y2}, ${x2} ${y2}`
    : `M${x1} ${y1} L${x2} ${y2}`;
  return (
    <g>
      <path d={d} fill="none" className={cls} strokeWidth={curve ? 1.3 : 1.6} strokeDasharray={broken ? "5 5" : undefined} />
      {broken && (
        <g transform={`translate(${(x1 + x2) / 2} ${(y1 + y2) / 2})`}>
          <circle r={13} className="fill-bg stroke-err" />
          <text textAnchor="middle" dy={5} className="fill-err text-svg-strong font-bold">
            ✕
          </text>
        </g>
      )}
    </g>
  );
}
