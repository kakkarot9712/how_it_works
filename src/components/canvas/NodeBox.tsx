import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * A clickable node on a sim canvas: a rounded box plus whatever you draw inside it.
 * Handles selection highlight, click-to-select (without bubbling to the canvas, which
 * deselects), and an `alert` outline (e.g. a crashed server).
 */
export function NodeBox({
  x,
  y,
  w,
  h,
  rx = 12,
  surface = "panel",
  selected,
  alert,
  dim,
  onSelect,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
  /** `panel` for primary nodes, `panel-2` for nodes nested inside a boundary. */
  surface?: "panel" | "panel-2";
  selected?: boolean;
  alert?: boolean;
  /** Fade the node (e.g. a closed connection). */
  dim?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
}) {
  return (
    <g
      className={onSelect ? "cursor-pointer" : undefined}
      onClick={onSelect ? (e) => (e.stopPropagation(), onSelect()) : undefined}
      opacity={dim ? 0.45 : 1}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        className={cx(
          surface === "panel" ? "fill-panel" : "fill-panel-2",
          selected ? "stroke-accent" : alert ? "stroke-err" : "stroke-line",
        )}
        strokeWidth={selected ? 2.5 : 1.2}
      />
      {children}
    </g>
  );
}
