"use client";

import Link from "next/link";
import { Boundary } from "@/components/canvas";
import { glossaryTitles } from "@/lib/glossary";
import { useProgress } from "./useProgress";
import type { SystemMapSpec } from "./systemMap";

/**
 * The path home's system map: every component of the system as a box that links to
 * the step explaining it. Components whose step is done get a ✓.
 */
export function SystemMapDiagram({ path, map }: { path: string; map: SystemMapSpec }) {
  const { done } = useProgress(path);
  const title = (s: string) => {
    const t = glossaryTitles(s);
    return t ? <title>{t}</title> : null;
  };
  return (
    <svg viewBox={`0 0 ${map.width} ${map.height}`} className="block w-full min-w-[720px]" role="img" aria-label="System map: click a component to open the step that explains it">
      <defs>
        <marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="fill-fg-muted" />
        </marker>
      </defs>

      {map.regions.map((r) => (
        <Boundary key={r.label} x={r.x} y={r.y} w={r.w} h={r.h} label={r.label} />
      ))}

      {map.wires.map((w, i) => {
        // The label goes on the longest horizontal segment.
        const segs = w.points.slice(1).map((p, j) => [w.points[j], p] as const).filter(([a, b]) => a[1] === b[1]);
        const [la, lb] = segs.sort((s1, s2) => Math.abs(s2[1][0] - s2[0][0]) - Math.abs(s1[1][0] - s1[0][0]))[0] ?? [w.points[0], w.points[1]];
        return (
          <g key={i}>
            <polyline
              points={w.points.map((p) => p.join(",")).join(" ")}
              className="fill-none stroke-fg-muted"
              strokeWidth={1.5}
              strokeDasharray={w.dashed ? "5 4" : undefined}
              markerEnd="url(#map-arrow)"
            />
            {w.label && (
              <text x={(la[0] + lb[0]) / 2} y={la[1] + (w.labelBelow ? 18 : -8)} textAnchor="middle" className="fill-fg-muted font-mono text-svg-caption">
                {title(w.label)}
                {w.label}
              </text>
            )}
          </g>
        );
      })}

      {map.nodes.map((n) => {
        const finished = done.has(n.step);
        return (
          <Link key={n.id} href={`/learn/${path}/${n.step}`} className="group">
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={12} className="fill-panel stroke-line transition-colors group-hover:stroke-accent" strokeWidth={1.5} />
            <text x={n.x + 14} y={n.y + 26} className="fill-fg text-svg-body font-semibold transition-colors group-hover:fill-accent">
              {title(n.label)}
              {n.label}
            </text>
            {finished && (
              <text x={n.x + n.w - 12} y={n.y + 26} textAnchor="end" className="fill-ok text-svg-body">
                ✓
              </text>
            )}
            {n.lines?.map((l, i) => (
              <text key={i} x={n.x + 14} y={n.y + 48 + i * 19} className="fill-fg-muted font-mono text-svg-caption">
                {title(l)}
                {l}
              </text>
            ))}
          </Link>
        );
      })}
    </svg>
  );
}
