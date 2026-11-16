"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { UNFOCUSED_OPACITY, useFocus } from "./Focus";

/**
 * A clickable node on a sim canvas: a rounded box plus whatever you draw inside it.
 * Handles selection highlight, click-to-select (without bubbling to the canvas, which
 * deselects), and an `alert` outline (e.g. a crashed server). Pass the node's `id` (the
 * same id the inspector selects) so the scenario's flow spotlight can halo or dim it.
 */
export function NodeBox({
  id,
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
  /** Node id, as used by `select()` and `Scenario.flow`. */
  id?: string;
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
  const focus = useFocus(id === undefined ? undefined : [id]);
  // The selected node is always in the spotlight: the user is looking at it.
  const off = focus === "off" && !selected;
  const faded = off || dim;
  return (
    <g onClick={onSelect ? (e) => (e.stopPropagation(), onSelect()) : undefined} className={cx(onSelect && "cursor-pointer")}>
      {/* A faded card stays opaque, so packets sliding under it don't show through. */}
      {faded && <rect x={x} y={y} width={w} height={h} rx={rx} className="fill-bg" />}
      <g opacity={off ? UNFOCUSED_OPACITY : dim ? 0.45 : 1} className="transition-opacity">
        {focus === "on" && (
          <rect x={x - 5} y={y - 5} width={w + 10} height={h + 10} rx={rx + 5} className="fill-none stroke-accent/45" strokeWidth={3} />
        )}
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
    </g>
  );
}
