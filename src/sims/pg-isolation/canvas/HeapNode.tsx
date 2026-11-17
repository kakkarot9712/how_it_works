import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { committedValue, HEAP as HEAP_ID, isVisible, RULE_TEXT, ROWS, SESSIONS, status, TABLE, viewSnapshot, type State, type Version } from "../model";
import { SESSION_COLOR, xactTone } from "../theme";
import { HEAP } from "./layout";

const SHOWN = 3;
const LINE = 19;
const COL = { id: 16, bal: 128, xmin: 150, xmax: 208, sees: 268 };

/**
 * The table's heap: every row version with its xmin and xmax (coloured by their status in
 * pg_xact), struck through once dead, and which session's snapshot would see it.
 */
export function HeapNode({ state: s, selected, onSelect }: { state: State; selected: boolean; onSelect: () => void }) {
  const { x, y, w, h } = HEAP;
  const views = SESSIONS.map((id) => ({ id, sess: s.sessions[id], snap: viewSnapshot(s, s.sessions[id]) }));
  const groups: { row: string; older: number; shown: Version[]; y: number }[] = [];
  for (const row of ROWS) {
    const all = s.versions.filter((v) => v.row === row);
    if (!all.length) continue;
    const shown = all.slice(-SHOWN);
    const prev = groups[groups.length - 1];
    const gy = prev ? prev.y + prev.shown.length * LINE + 8 : y + 80;
    groups.push({ row, older: all.length - shown.length, shown, y: gy });
  }

  const dead = (v: Version) => status(s, v.xmin) === "aborted" || (v.xmax !== null && status(s, v.xmax) === "committed");
  const xidFill = (xid: number) => toneColor[xactTone(status(s, xid))];
  const a = committedValue(s, "alice") ?? 0;
  const b = committedValue(s, "bob") ?? 0;
  const ok = a + b >= 0;

  return (
    <NodeBox id={HEAP_ID} x={x} y={y} w={w} h={h} surface="panel-2" rx={10} selected={selected} onSelect={onSelect}>
      <text x={x + 16} y={y + 26} className="fill-fg-muted text-svg-body">
        table <tspan className="fill-fg font-mono text-svg-title font-semibold">{TABLE}</tspan>
      </text>
      <text x={x + w - 16} y={y + 26} textAnchor="end" className="fill-fg-muted text-svg-body">
        row versions
      </text>
      <g className="fill-fg-muted text-svg-body">
        <text x={x + COL.id} y={y + 52}>id</text>
        <text x={x + COL.bal} y={y + 52} textAnchor="end">balance</text>
        <text x={x + COL.xmin} y={y + 52}>xmin</text>
        <text x={x + COL.xmax} y={y + 52}>xmax</text>
        <text x={x + COL.sees} y={y + 52}>seen by</text>
      </g>
      <line x1={x + 12} x2={x + w - 12} y1={y + 60} y2={y + 60} className="stroke-line" />

      {groups.map((g) => (
        <g key={g.row}>
          <text x={x + COL.id} y={g.y} className="fill-fg font-mono text-svg-body">
            {g.row}
          </text>
          {g.older > 0 && (
            <text x={x + COL.id} y={g.y + LINE} className="fill-fg-muted font-mono text-svg-body">
              +{g.older} older
            </text>
          )}
          {g.shown.map((v, i) => {
            const vy = g.y + i * LINE;
            const isDead = dead(v);
            return (
              <g key={v.n}>
                <text x={x + COL.bal} y={vy} textAnchor="end" className={`font-mono text-svg-body ${isDead ? "fill-fg-muted line-through" : "fill-fg"}`}>
                  {v.balance}
                </text>
                <text x={x + COL.xmin} y={vy} className="font-mono text-svg-body" fill={xidFill(v.xmin)}>
                  {v.xmin}
                </text>
                <text x={x + COL.xmax} y={vy} className="font-mono text-svg-body" fill={v.xmax === null ? toneColor.muted : xidFill(v.xmax)}>
                  {v.xmax ?? "—"}
                </text>
                {views.map(({ id, sess, snap }, k) =>
                  snap && isVisible(s, v, snap, sess.tx?.xid ?? null) ? (
                    <text key={id} x={x + COL.sees + k * 20} y={vy} className="font-mono text-svg-body font-semibold" fill={SESSION_COLOR[id]}>
                      {id}
                    </text>
                  ) : null,
                )}
              </g>
            );
          })}
        </g>
      ))}

      <line x1={x + 12} x2={x + w - 12} y1={y + h - 74} y2={y + h - 74} className="stroke-line" />
      <text x={x + 16} y={y + h - 54} className="fill-fg-muted font-mono text-svg-body">
        committed: alice + bob = <tspan fill={ok ? toneColor.ok : toneColor.err}>{a + b}</tspan>
      </text>
      <text x={x + 16} y={y + h - 34} className="text-svg-body" fill={ok && !s.lostUpdates ? toneColor.muted : toneColor.err}>
        {s.lostUpdates
          ? "a committed deposit was lost ✕"
          : ok
            ? `household rule ${RULE_TEXT} holds ✓`
            : `household rule ${RULE_TEXT} broken ✕`}
      </text>
      <g transform={`translate(${x + 16} ${y + h - 14})`} className="text-svg-body">
        <text className="fill-fg-muted">xid:</text>
        <text x={34} fill={toneColor.ok}>committed</text>
        <text x={118} fill={toneColor.warn}>in progress</text>
        <text x={210} fill={toneColor.err}>aborted</text>
      </g>
    </NodeBox>
  );
}
