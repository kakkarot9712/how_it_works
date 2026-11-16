"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx, IconButton, Kbd, surfaceClass } from "@/components/ui";

const MIN = 0.5;
const MAX = 4;

interface View {
  k: number;
  x: number;
  y: number;
}

const FIT: View = { k: 1, x: 0, y: 0 };

/** Zoom by factor `f`, keeping the point (cx, cy) under the cursor fixed. */
function zoomAt(v: View, cx: number, cy: number, f: number): View {
  const k = Math.min(MAX, Math.max(MIN, v.k * f));
  const r = k / v.k;
  return { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r };
}

/**
 * Wraps a sim canvas with zoom and pan:
 * - mouse wheel / trackpad pinch zooms around the cursor
 * - drag empty space or nodes to pan (a drag never counts as a click)
 * - +, -, 0 keys and the on-screen buttons
 *
 * It uses a CSS transform on a wrapper, so sims don't need to know about it.
 * Without will-change, the browser re-rasterizes the SVG at each scale, so
 * text stays sharp.
 */
export function ZoomPan({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>(FIT);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      // Pinch gestures arrive as ctrl+wheel with small deltas.
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      setView((v) => zoomAt(v, e.clientX - r.left, e.clientY - r.top, f));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomCenter = (f: number) => {
    const el = box.current;
    if (!el) return;
    setView((v) => zoomAt(v, el.clientWidth / 2, el.clientHeight / 2, f));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey) return;
      const el = box.current;
      if (!el) return;
      const at = (f: number) => setView((v) => zoomAt(v, el.clientWidth / 2, el.clientHeight / 2, f));
      if (e.key === "+" || e.key === "=") at(1.25);
      else if (e.key === "-" || e.key === "_") at(0.8);
      else if (e.key === "0") setView(FIT);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      ref={box}
      className={cx("absolute inset-0 touch-none overflow-hidden", dragging ? "cursor-grabbing" : "cursor-grab")}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y, moved: false, id: e.pointerId };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.px;
        const dy = e.clientY - d.py;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        if (!d.moved) {
          d.moved = true;
          setDragging(true);
          e.currentTarget.setPointerCapture(d.id);
        }
        setView((v) => ({ ...v, x: d.x + dx, y: d.y + dy }));
      }}
      onPointerUp={() => {
        setDragging(false);
        // Keep `moved` until the click that follows, so it can be swallowed.
        if (drag.current && !drag.current.moved) drag.current = null;
      }}
      onClickCapture={(e) => {
        if (drag.current?.moved) {
          e.stopPropagation();
          e.preventDefault();
        }
        drag.current = null;
      }}
    >
      <div
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
      >
        {children}
      </div>

      <div
        className={surfaceClass({ elevated: true }, "absolute left-3 top-3 flex items-center gap-0.5 p-1")}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <IconButton size="sm" label="Zoom out (-)" onClick={() => zoomCenter(0.8)}>
          −
        </IconButton>
        <button
          type="button"
          title="Fit to screen (0)"
          onClick={() => setView(FIT)}
          className="w-14 rounded-md px-1 py-1 text-center font-mono text-xs text-fg-muted transition-colors hover:bg-panel-2 hover:text-fg"
        >
          {Math.round(view.k * 100)}%
        </button>
        <IconButton size="sm" label="Zoom in (+)" onClick={() => zoomCenter(1.25)}>
          +
        </IconButton>
      </div>
      <div className="pointer-events-none absolute left-3 top-[54px] whitespace-nowrap text-xs leading-snug text-fg-muted/70">
        scroll to zoom · drag to pan · <Kbd>0</Kbd> to fit
      </div>
    </div>
  );
}
