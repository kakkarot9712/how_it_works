import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { XACT as XACT_ID, type State } from "../model";
import { SESSION_COLOR, xactTone } from "../theme";
import { XACT } from "./layout";

const SHOWN = 4;

/** pg_xact: the commit status of each transaction ID. A commit or abort is one status change here. */
export function XactNode({ state: s, selected, onSelect }: { state: State; selected: boolean; onSelect: () => void }) {
  const { x, y, w, h } = XACT;
  const xids = Object.keys(s.xact)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, SHOWN);
  return (
    <NodeBox id={XACT_ID} x={x} y={y} w={w} h={h} surface="panel-2" rx={10} selected={selected} onSelect={onSelect}>
      <text x={x + 16} y={y + 26} className="fill-fg font-mono text-svg-title font-semibold">
        pg_xact
      </text>
      <text x={x + w - 16} y={y + 26} textAnchor="end" className="fill-fg-muted text-svg-body">
        next xid <tspan className="fill-fg font-mono">{s.nextXid}</tspan>
      </text>
      {xids.map((xid, i) => {
        const st = s.xact[xid];
        const owner = s.xactOwner[xid];
        return (
          <g key={xid}>
            <text x={x + 16} y={y + 52 + i * 19} className="fill-fg font-mono text-svg-body">
              {xid}
            </text>
            <text x={x + 64} y={y + 52 + i * 19} className="font-mono text-svg-body" fill={toneColor[xactTone(st)]}>
              {st}
            </text>
            <text x={x + w - 16} y={y + 52 + i * 19} textAnchor="end" className="text-svg-body" fill={owner === "setup" ? toneColor.muted : SESSION_COLOR[owner]}>
              {owner === "setup" ? "table load" : `Session ${owner}`}
            </text>
          </g>
        );
      })}
    </NodeBox>
  );
}
