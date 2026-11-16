import { cx } from "@/lib/cx";

/** A dashed region grouping nodes that live together, e.g. "redis-server process · memory". */
export function Boundary({
  x,
  y,
  w,
  h,
  label,
  alert,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  /** Red outline, e.g. while the process is down. */
  alert?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={16}
        className={cx("fill-panel/40", alert ? "stroke-err/60" : "stroke-line")}
        strokeDasharray="7 6"
      />
      {label && (
        <text x={x + 16} y={y + 28} className="fill-fg-muted text-svg-body">
          {label}
        </text>
      )}
    </g>
  );
}
