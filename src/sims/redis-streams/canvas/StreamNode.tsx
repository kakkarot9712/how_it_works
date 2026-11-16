import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { DEAD_KEY, lastId, RESTART_MS, STREAM as STREAM_ID, STREAM_KEY, type State } from "../model";
import { GROUP_COLOR } from "../theme";
import { STREAM, TAPE_CELLS } from "./layout";
import { glossaryTitle } from "@/lib/glossary";

const TAPE_X = 104;
const CELL_GAP = 4;

/**
 * The stream key inside redis-server: length vs MAXLEN, the newest entries as a tape,
 * and one row per consumer group showing which entries it has delivered, acked or left pending.
 */
export function StreamNode({ state: s, now, selected, onSelect }: { state: State; now: number; selected: boolean; onSelect: () => void }) {
  const { x, y, w, h } = STREAM;
  const st = s.stream;
  const shown = st.entries.slice(-TAPE_CELLS);
  const step = (w - TAPE_X - 14) / TAPE_CELLS;
  const cw = step - CELL_GAP;
  const tapeY = y + 68;
  const len = st.entries.length;
  const over = s.components.maxlen && len >= s.settings.maxLen;

  return (
    <NodeBox id={STREAM_ID} x={x} y={y} w={w} h={h} surface="panel-2" rx={10} selected={selected} alert={!s.server.up} onSelect={onSelect}>
      <text x={x + 16} y={y + 28} className="fill-fg-muted text-svg-body">
        stream <tspan className="fill-fg font-mono text-svg-title font-semibold">{STREAM_KEY}</tspan>
      </text>
      <text x={x + w - 16} y={y + 28} textAnchor="end" className={s.server.up ? "fill-ok text-svg-body" : "fill-err text-svg-body"}>
        redis-server {s.server.up ? "● up" : "● DOWN"}
      </text>
      <text x={x + 16} y={y + 52} className="fill-fg-muted font-mono text-svg-body">
        XLEN <tspan className={over ? "fill-warn" : "fill-fg"}>{len}</tspan>
        {s.components.maxlen ? ` / MAXLEN ${s.settings.maxLen}` : " (no MAXLEN)"} · entries-added <tspan className="fill-fg">{st.entriesAdded}</tspan>
      </text>
      <text x={x + w - 16} y={y + 52} textAnchor="end" className="font-mono text-svg-body" fill={st.trimmed ? toneColor.warn : toneColor.muted}>
        trimmed {st.trimmed}
      </text>

      {/* the tape: newest entries, oldest on the left */}
      <text x={x + 16} y={tapeY + 20} className="fill-fg-muted text-svg-body">
        entries
      </text>
      {shown.map((e, i) => (
        <g key={e.n}>
          <rect
            x={x + TAPE_X + i * step}
            y={tapeY}
            width={cw}
            height={28}
            rx={3}
            className="fill-bg"
            stroke={e.poison ? toneColor.err : "var(--color-line)"}
            strokeWidth={e.poison ? 1.6 : 1}
          />
          <text x={x + TAPE_X + i * step + cw / 2} y={tapeY + 19} textAnchor="middle" className={e.poison ? "fill-err font-mono text-svg-caption" : "fill-fg font-mono text-svg-caption"}>
            {e.order}
          </text>
        </g>
      ))}
      {len === 0 && (
        <text x={x + TAPE_X} y={tapeY + 19} className="fill-fg-muted text-svg-body">
          (empty)
        </text>
      )}

      {/* one row per group: acked (group colour), pending (warn/err), not yet delivered (outline) */}
      {s.groupIds.map((gid, r) => {
        const g = s.groups[gid];
        const ry = tapeY + 42 + r * 22;
        return (
          <g key={gid}>
            <text x={x + 16} y={ry + 10} className="text-svg-body" fill={GROUP_COLOR[gid]}>
              {g.name}
            </text>
            {shown.map((e, i) => {
              const p = g.pel.find((q) => q.n === e.n);
              const idle = p ? now - p.deliveredAt : 0;
              const fill = e.n > g.lastN ? undefined : p ? (idle >= s.settings.minIdleMs ? toneColor.err : toneColor.warn) : GROUP_COLOR[gid];
              return (
                <rect
                  key={e.n}
                  x={x + TAPE_X + i * step}
                  y={ry}
                  width={cw}
                  height={10}
                  rx={2}
                  fill={fill}
                  opacity={fill && !p ? 0.55 : 1}
                  className={fill ? undefined : "fill-bg stroke-line"}
                />
              );
            })}
          </g>
        );
      })}

      <text x={x + 16} y={y + 168} className="fill-fg-muted font-mono text-svg-body">
        last-generated-id <tspan className="fill-fg">{lastId(s)}</tspan>
      </text>
      {s.components.deadLetter && s.components.ack && (
        <text x={x + w - 16} y={y + 168} textAnchor="end" className="font-mono text-svg-body" fill={s.deadLetter.length ? toneColor.err : toneColor.muted}>
          {DEAD_KEY} · {s.deadLetter.length}
        </text>
      )}
      <g transform={`translate(${x + 16} ${y + 182})`} className="fill-fg-muted text-svg-caption">
        <rect width={14} height={9} rx={2} y={1} fill="var(--color-ch-1)" opacity={0.55} />
        <text x={20} y={10}>acked</text>
        <rect x={76} width={14} height={9} rx={2} y={1} fill={toneColor.warn} />
        <text x={96} y={10}>
          <title>{glossaryTitle("PEL")}</title>
          pending (PEL)
        </text>
        <rect x={204} width={14} height={9} rx={2} y={1} fill={toneColor.err} />
        <text x={224} y={10}>idle ≥ min-idle-time</text>
        <rect x={382} width={14} height={9} rx={2} y={1} className="fill-bg stroke-line" />
        <text x={402} y={10}>not delivered</text>
      </g>

      {!s.server.up && (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={10} className="fill-bg/95" />
          <text x={x + w / 2} y={y + h / 2 - 8} textAnchor="middle" className="fill-err text-svg-display font-bold">
            PROCESS DOWN
          </text>
          <text x={x + w / 2} y={y + h / 2 + 18} textAnchor="middle" className="fill-fg-muted text-svg-body">
            <title>{glossaryTitle("AOF")}</title>
            {s.server.downSince !== null
              ? `restarting in ${Math.max(0, (s.server.downSince + RESTART_MS - now) / 1000).toFixed(1)}s, then reloading the AOF`
              : ""}
          </text>
        </g>
      )}
    </NodeBox>
  );
}
