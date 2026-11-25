import { Bar, NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { glossaryTitle } from "@/lib/glossary";
import { committedOf, consId, KEYS, lagOf, leo, ownerOf, partId, partitionForKey, type State } from "../model";
import { lagTone, recView } from "../theme";
import { PART, PART_TOP, TAPE_CELLS } from "./layout";

const CELL = 24;
const GAP = 2;

/** One partition of `orders`: its newest offsets as a tape, the group's committed offset, LEO and lag. */
export function PartitionNode({ state: s, p, selected, onSelect }: { state: State; p: number; selected: boolean; onSelect: () => void }) {
  const { x, w, h } = PART;
  const y = PART_TOP[p];
  const log = s.partitions[p].log;
  const end = leo(s, p);
  const first = Math.max(0, end - TAPE_CELLS);
  const committed = committedOf(s, p);
  const lag = lagOf(s, p);
  const owner = ownerOf(s, p);
  const keys = KEYS.filter((k) => partitionForKey(k) === p);
  const lx = x + 14;
  const rx = x + w - 14;
  const tapeY = y + 64;
  const cellX = (o: number) => lx + (o - first) * (CELL + GAP);
  const commitX = committed >= first ? cellX(committed) - GAP / 2 : null;

  return (
    <NodeBox id={partId(p)} x={x} y={y} w={w} h={h} selected={selected} onSelect={onSelect}>
      <text x={lx} y={y + 26} className="fill-fg font-mono text-svg-title font-semibold">
        {partId(p)}
      </text>
      <text x={rx} y={y + 26} textAnchor="end" className="text-svg-body" fill={owner === null ? toneColor.warn : toneColor.muted}>
        {owner === null ? "no owner" : `→ ${consId(owner)}`}
      </text>
      <text x={lx} y={y + 48} className="fill-fg-muted text-svg-body">
        {s.components.keyPartitioning ? `keys ${keys.join(", ")}` : "keys: any (ignored)"}
      </text>
      {log.slice(first).map((r) => {
        const v = recView(s, p, r);
        return (
          <g key={r.offset}>
            <rect x={cellX(r.offset)} y={tapeY} width={CELL} height={30} rx={3} className={v.fill ? undefined : "fill-panel-2 stroke-line"} fill={v.fill ?? undefined} fillOpacity={v.opacity}>
              <title>{`offset ${r.offset}, key ${r.key}: ${v.label}`}</title>
            </rect>
            <text x={cellX(r.offset) + CELL / 2} y={tapeY + 20} textAnchor="middle" className="pointer-events-none fill-fg font-mono text-svg-caption">
              {r.poison ? "✕" : r.key}
            </text>
          </g>
        );
      })}
      {commitX !== null && (
        <line x1={commitX} x2={commitX} y1={tapeY - 6} y2={tapeY + 36} stroke={toneColor.accent} strokeWidth={2.5}>
          <title>{`committed offset ${committed}: the next record the group will read after a rebalance or restart`}</title>
        </line>
      )}
      <text x={lx} y={tapeY + 52} className="fill-fg-muted font-mono text-svg-caption">
        {first}
      </text>
      <text x={lx + TAPE_CELLS * (CELL + GAP) - GAP} y={tapeY + 52} textAnchor="end" className="fill-fg-muted font-mono text-svg-caption">
        {end > 0 ? end - 1 : ""}
      </text>
      <text x={lx} y={y + 140} className="fill-fg-muted text-svg-body">
        <title>{glossaryTitle("LEO")}</title>
        LEO <tspan className="fill-fg font-mono">{end}</tspan>
        {"   "}committed <tspan className="font-mono" fill={toneColor.accent}>{committed}</tspan>
        {"   "}lag{" "}
        <tspan className="font-mono" fill={toneColor[lagTone(lag)]}>
          {lag}
        </tspan>
      </text>
      <Bar x={lx} y={y + 150} width={w - 28} height={6} value={Math.min(1, lag / 20)} color={toneColor[lagTone(lag)]} track="panel-2" />
    </NodeBox>
  );
}
