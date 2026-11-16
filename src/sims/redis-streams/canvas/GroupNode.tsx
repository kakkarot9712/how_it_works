import { NodeBox } from "@/components/canvas";
import { toneFill } from "@/components/ui";
import { lag, pendingOf, type Group, type State } from "../model";
import { GROUP_COLOR, groupLagText, pendingTone } from "../theme";
import { GROUPS } from "./layout";

const ROW = 21;

/** A consumer group: last-delivered-id, entries-read and lag (as XINFO GROUPS reports them), consumers, and its PEL as XPENDING would list it. */
export function GroupNode({
  state: s,
  group: g,
  now,
  selected,
  onSelect,
}: {
  state: State;
  group: Group;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { x, y, w, h } = GROUPS[g.id];
  const l = lag(s, g);
  const tx = x + 262;
  const maxRows = Math.floor((h - 74 - 50) / ROW) + 1;
  const rows = g.pel.slice(0, g.pel.length > maxRows ? maxRows - 1 : maxRows);
  const more = g.pel.length - rows.length;
  const problems = [
    g.trimmedUnread ? `trimmed unread ${g.trimmedUnread}` : "",
    g.lostNoAck ? `lost ${g.lostNoAck}` : "",
    g.duplicates ? `dup ${g.duplicates}` : "",
    g.deadLettered ? `dead-lettered ${g.deadLettered}` : "",
  ].filter(Boolean);

  return (
    <NodeBox x={x} y={y} w={w} h={h} surface="panel-2" rx={10} selected={selected} dim={!s.server.up} onSelect={onSelect}>
      <circle cx={x + 22} cy={y + 22} r={5.5} fill={GROUP_COLOR[g.id]} />
      <text x={x + 34} y={y + 28} className="fill-fg-muted text-svg-body">
        group <tspan className="fill-fg font-mono text-svg-title font-semibold">{g.name}</tspan>
      </text>

      <text x={x + 16} y={y + 58} className="fill-fg-muted text-svg-caption uppercase tracking-wider">
        last-delivered-id
      </text>
      <text x={x + 16} y={y + 78} className="fill-fg font-mono text-svg-strong">
        {g.lastId}
      </text>
      <text x={x + 16} y={y + 106} className="fill-fg-muted text-svg-caption uppercase tracking-wider">
        entries-read · lag
      </text>
      <text x={x + 16} y={y + 126} className="fill-fg font-mono text-svg-strong">
        {g.lastN} ·{" "}
        <tspan className={l === null ? "fill-err" : l > 5 ? "fill-warn" : "fill-fg"}>lag {groupLagText(l)}</tspan>
      </text>
      <text x={x + 16} y={y + 154} className="fill-fg-muted text-svg-caption uppercase tracking-wider">
        consumers · pending
      </text>
      {g.consumers.map((cid, i) => (
        <text key={cid} x={x + 16} y={y + 176 + i * 21} className="fill-fg font-mono text-svg-body">
          {s.consumers[cid].label}
          <tspan x={x + 200} textAnchor="end" className={pendingOf(g, cid) ? "fill-warn" : "fill-fg-muted"}>
            {pendingOf(g, cid)}
          </tspan>
        </text>
      ))}

      {/* PEL, like XPENDING orders <group> - + 10 */}
      <line x1={tx - 16} x2={tx - 16} y1={y + 14} y2={y + h - 14} className="stroke-line" />
      <text x={tx} y={y + 28} className="fill-fg-muted text-svg-caption uppercase tracking-wider">
        {s.components.ack ? `PEL · ${g.pel.length} pending` : "PEL · NOACK, nothing tracked"}
      </text>
      <g className="fill-fg-muted text-svg-caption">
        <text x={tx} y={y + 52}>ID</text>
        <text x={tx + 66} y={y + 52}>order</text>
        <text x={tx + 102} y={y + 52}>consumer</text>
        <text x={tx + 246} y={y + 52} textAnchor="end">idle</text>
        <text x={tx + 286} y={y + 52} textAnchor="end">deliv.</text>
      </g>
      {rows.map((p, i) => {
        const idle = now - p.deliveredAt;
        const tone = pendingTone(idle, p.deliveries, s.settings.minIdleMs);
        const ry = y + 74 + i * ROW;
        const poison = s.stream.entries.find((e) => e.n === p.n)?.poison;
        return (
          <g key={p.n} className="font-mono text-svg-body">
            <text x={tx} y={ry} className="fill-fg">
              {p.id}
            </text>
            <text x={tx + 66} y={ry} className={poison ? "fill-err" : "fill-fg"}>
              #{p.order}
            </text>
            <text x={tx + 102} y={ry} className="fill-fg">
              {s.consumers[p.owner].label}
            </text>
            <text x={tx + 246} y={ry} textAnchor="end" className={toneFill[tone]}>
              {(idle / 1000).toFixed(1)}s
            </text>
            <text x={tx + 286} y={ry} textAnchor="end" className={p.deliveries > 1 ? "fill-warn" : "fill-fg"}>
              {p.deliveries}
            </text>
          </g>
        );
      })}
      {s.components.ack && g.pel.length === 0 && (
        <text x={tx} y={y + 74} className="fill-fg-muted text-svg-body">
          (empty: everything delivered is acked)
        </text>
      )}
      {more > 0 && (
        <text x={tx} y={y + 74 + rows.length * ROW} className="fill-fg-muted text-svg-body">
          +{more} more
        </text>
      )}
      {problems.length > 0 && (
        <text x={tx} y={y + h - 34} className="fill-warn font-mono text-svg-body">
          {problems.join(" · ")}
        </text>
      )}
      <text x={tx} y={y + h - 14} className="fill-fg-muted font-mono text-svg-body">
        acked {g.acked} · claimed <tspan className={g.claimed ? "fill-warn" : undefined}>{g.claimed}</tspan>
      </text>
    </NodeBox>
  );
}
