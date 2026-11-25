"use client";

import { useEffect, useRef } from "react";
import { glossaryTitles } from "@/lib/glossary";
import { cx } from "@/lib/cx";
import type { TraceActor, TraceHop, TraceSpec } from "./trace";

/** viewBox width; the diagram sits in a max-w-3xl column (~760px), so units ≈ pixels. */
const W = 760;
const GUTTER = 34;
const HEAD_Y = 8;
/** Actor box: name and role, then one line per state field. */
const NAME_H = 46;
const FIELD_H = 18;
const ROWS_Y = 4;
export const TRACE_ROW_H = 40;
/** Approximate width of a label at text-svg-body (13.5 units, mono-ish digits). */
const labelWidth = (s: string) => s.length * 7.4 + 12;

/** Centre x of each actor's lifeline. */
export function traceColumns(n: number): number[] {
  const span = W - GUTTER - 8;
  return Array.from({ length: n }, (_, i) => GUTTER + (span * (i + 0.5)) / n);
}

/**
 * A sequence diagram: one lifeline per actor, one row per hop. Hops before `at` are
 * drawn solid, the current one in accent, later ones faded, so stepping through reads
 * like a request travelling down the page. Click a row to jump to it.
 *
 * The actor heads are a separate SVG that stays put and shows each actor's state after
 * the current hop (cells the hop changed in accent). The rows scroll in a short window
 * (unless `expanded`) that keeps the current hop centred, so the whole trace fits on one screen.
 */
export function TraceDiagram({
  actors,
  hops,
  at,
  onPick,
  expanded,
  fields = [],
  state = {},
  changed = new Set(),
}: {
  actors: TraceActor[];
  hops: TraceHop[];
  at: number;
  onPick: (i: number) => void;
  expanded?: boolean;
  fields?: NonNullable<TraceSpec["state"]>["fields"];
  /** Actor id → field → value, after hop `at`. */
  state?: Record<string, Record<string, string>>;
  /** "actor.field" cells hop `at` changed. */
  changed?: Set<string>;
}) {
  const xs = traceColumns(actors.length);
  const col = (id: string) => xs[actors.findIndex((a) => a.id === id)];
  const boxW = Math.min(150, (W - GUTTER) / actors.length - 14);
  const H = ROWS_Y + hops.length * TRACE_ROW_H + 10;
  const rowsRef = useRef<HTMLDivElement>(null);
  // Each actor shows only the fields it has; boxes share the tallest height.
  const own = (id: string) => fields.filter((f) => state[id]?.[f.id] !== undefined);
  const maxFields = Math.max(0, ...actors.map((a) => own(a.id).length));
  const boxH = NAME_H + (maxFields ? 6 + maxFields * FIELD_H : 0);
  const headH = HEAD_Y + boxH + 10;

  // Keep the current hop in the middle of the rows window, without scrolling the page.
  useEffect(() => {
    const box = rowsRef.current;
    const row = box?.querySelector(`[data-hop="${at}"]`);
    if (!box || !row || expanded) return;
    const b = box.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    box.scrollTo({
      top: box.scrollTop + (r.top + r.height / 2) - (b.top + b.height / 2),
      behavior: "smooth",
    });
  }, [at, expanded]);

  return (
    <div className="min-w-[640px]">
      <svg viewBox={`0 0 ${W} ${headH}`} className="block w-full" role="img" aria-label="Actors in the trace and their state">
        {actors.map((a, i) => (
          <line key={a.id} x1={xs[i]} x2={xs[i]} y1={HEAD_Y + boxH} y2={headH} className="stroke-line" strokeDasharray="4 4" />
        ))}
        {actors.map((a, i) => {
          const x = xs[i] - boxW / 2;
          return (
            <g key={a.id}>
              <rect x={x} y={HEAD_Y} width={boxW} height={boxH} rx={10} className="fill-panel-2 stroke-line" />
              <text x={xs[i]} y={HEAD_Y + (a.sub ? 20 : 27)} textAnchor="middle" className="fill-fg text-svg-body font-semibold">
                {glossaryTitles(a.label) && <title>{glossaryTitles(a.label)}</title>}
                {a.label}
              </text>
              {a.sub && (
                <text x={xs[i]} y={HEAD_Y + 37} textAnchor="middle" className="fill-fg-muted text-svg-caption">
                  {glossaryTitles(a.sub) && <title>{glossaryTitles(a.sub)}</title>}
                  {a.sub}
                </text>
              )}
              {own(a.id).length > 0 && <line x1={x + 8} x2={x + boxW - 8} y1={HEAD_Y + NAME_H} y2={HEAD_Y + NAME_H} className="stroke-line" />}
              {own(a.id).map((f, k) => {
                const hot = changed.has(`${a.id}.${f.id}`);
                const y = HEAD_Y + NAME_H + 4 + (k + 1) * FIELD_H - 4;
                return (
                  <g key={f.id}>
                    {hot && <rect x={x + 4} y={y - 13} width={boxW - 8} height={FIELD_H} rx={4} className="fill-accent/15" />}
                    <text x={x + 10} y={y} className={cx("font-mono text-svg-caption", hot ? "fill-accent" : "fill-fg-muted")}>
                      <title>{[f.label, glossaryTitles(f.short)].filter(Boolean).join("\n")}</title>
                      {f.short}
                    </text>
                    <text x={x + boxW - 10} y={y} textAnchor="end" className={cx("font-mono text-svg-caption", hot ? "fill-accent font-semibold" : "fill-fg")}>
                      {state[a.id][f.id]}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div
        ref={rowsRef}
        className={cx(
          "scrollbar-thin",
          !expanded && "max-h-56 overflow-y-auto",
        )}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="Sequence diagram of the trace"
        >
          {/* lifelines */}
          {actors.map((a, i) => (
            <line
              key={a.id}
              x1={xs[i]}
              x2={xs[i]}
              y1={0}
              y2={H}
              className="stroke-line"
              strokeDasharray="4 4"
            />
          ))}

          {/* hops */}
          {hops.map((h, i) => {
            // Each row: label (and row number) on one baseline, the arrow just under it.
            const top = ROWS_Y + i * TRACE_ROW_H;
            const ty = top + 20;
            const y = top + 30;
            const state = i < at ? "past" : i === at ? "now" : "future";
            const x1 = col(h.from);
            const x2 = col(h.to);
            const self = h.from === h.to;
            const stroke =
              state === "now" ? "stroke-accent" : "stroke-fg-muted";
            const fill = state === "now" ? "fill-accent" : "fill-fg-muted";
            const text =
              state === "now" ? "fill-accent font-semibold" : "fill-fg";
            const lw = labelWidth(h.label);
            const tip = glossaryTitles(h.label);
            const flip = self && x1 + 10 + lw > W - 4;
            return (
              <g
                key={i}
                data-hop={i}
                className={cx(
                  "cursor-pointer transition-opacity",
                  state === "future" && "opacity-30",
                )}
                onClick={() => onPick(i)}
              >
                {/* hit area for the whole row */}
                <rect
                  x={0}
                  y={top}
                  width={W}
                  height={TRACE_ROW_H}
                  className={cx(
                    "fill-transparent",
                    state === "now" && "fill-accent/5",
                  )}
                />
                <text
                  x={6}
                  y={ty}
                  className={cx(
                    "font-mono text-svg-caption",
                    state === "now" ? "fill-accent" : "fill-fg-muted",
                  )}
                >
                  {i + 1}
                </text>
                {self ? (
                  <>
                    <rect
                      x={x1 - 5}
                      y={ty - 9}
                      width={10}
                      height={10}
                      rx={2}
                      className={fill}
                    />
                    {/* Label right of the marker, or left of it when it would run off the diagram. */}
                    <rect
                      x={flip ? x1 - 10 - lw : x1 + 10}
                      y={ty - 14}
                      width={lw}
                      height={19}
                      rx={4}
                      className="fill-bg"
                    />
                    <text
                      x={flip ? x1 - 16 : x1 + 16}
                      y={ty}
                      textAnchor={flip ? "end" : "start"}
                      className={cx("font-mono text-svg-body", text)}
                    >
                      {tip && <title>{tip}</title>}
                      {h.label}
                    </text>
                  </>
                ) : (
                  <>
                    <line
                      x1={x1}
                      x2={x2 + (x2 > x1 ? -7 : 7)}
                      y1={y}
                      y2={y}
                      className={stroke}
                      strokeWidth={state === "now" ? 2.5 : 1.5}
                      strokeDasharray={h.reply ? "5 4" : undefined}
                    />
                    <polygon
                      points={
                        x2 > x1
                          ? `${x2},${y} ${x2 - 9},${y - 5} ${x2 - 9},${y + 5}`
                          : `${x2},${y} ${x2 + 9},${y - 5} ${x2 + 9},${y + 5}`
                      }
                      className={fill}
                    />
                    <rect
                      x={(x1 + x2) / 2 - lw / 2}
                      y={ty - 14}
                      width={lw}
                      height={19}
                      rx={4}
                      className="fill-bg"
                    />
                    <text
                      x={(x1 + x2) / 2}
                      y={ty}
                      textAnchor="middle"
                      className={cx("font-mono text-svg-body", text)}
                    >
                      {tip && <title>{tip}</title>}
                      {h.label}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
