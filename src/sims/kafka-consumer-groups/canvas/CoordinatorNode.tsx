import { Bar, NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { CONSUMERS, consId, COORD, GROUP, type State } from "../model";
import { groupStateTone } from "../theme";
import { COORD_BOX, coordPortY } from "./layout";

/** The group coordinator (a broker): group state, epoch, and each member's heartbeat age against the session timeout. */
export function CoordinatorNode({ state: s, now, selected, onSelect }: { state: State; now: number; selected: boolean; onSelect: () => void }) {
  const { x, y, w, h } = COORD_BOX;
  const g = s.coord;
  const lx = x + 14;
  const rx = x + w - 14;
  const classic = !s.components.incremental;

  return (
    <NodeBox id={COORD} x={x} y={y} w={w} h={h} selected={selected} onSelect={onSelect}>
      <text x={lx} y={y + 26} className="fill-fg text-svg-title font-semibold">
        group coordinator
      </text>
      <text x={rx} y={y + 26} textAnchor="end" className="font-mono text-svg-body" fill={toneColor[groupStateTone(s)]}>
        {g.state}
      </text>
      {CONSUMERS.map((c) => {
        const m = g.members[c];
        const py = coordPortY(c);
        if (!m)
          return (
            <text key={c} x={lx} y={py + 5} className="fill-fg-muted text-svg-body" opacity={0.5}>
              {consId(c)} <tspan>not a member</tspan>
            </text>
          );
        const age = Math.max(0, now - m.lastHb);
        const frac = Math.min(1, age / s.settings.sessionMs);
        return (
          <g key={c}>
            <text x={lx} y={py + 5} className="fill-fg font-mono text-svg-body">
              {consId(c)}
            </text>
            <Bar x={lx + 110} y={py - 3} width={130} height={8} value={frac} color={frac > 0.6 ? toneColor.err : toneColor.ok} track="panel-2" markers={[{ at: 1, color: toneColor.err }]} />
            <text x={rx} y={py + 5} textAnchor="end" className="fill-fg-muted font-mono text-svg-body">
              {m.owned.length ? m.owned.map((p) => `p${p}`).join(",") : "–"}
            </text>
          </g>
        );
      })}
      <text x={lx} y={y + h - 10} className="fill-fg-muted text-svg-caption">
        {GROUP} · {classic ? "classic, range" : "consumer, uniform"} · {classic ? "gen" : "epoch"} {g.groupEpoch}
      </text>
    </NodeBox>
  );
}
