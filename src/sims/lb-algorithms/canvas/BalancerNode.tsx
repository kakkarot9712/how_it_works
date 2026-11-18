import { NodeBox } from "@/components/canvas";
import { toneColor, type Tone } from "@/components/ui";
import { glossaryTitles } from "@/lib/glossary";
import { LANE_INFO, lbNode, percentile, serverLabel, secs, type LaneId, type State } from "../model";
import { LB } from "./layout";

/** One nginx upstream group: its balancing method, the last decision and why, and its response times. */
export function BalancerNode({
  state: s,
  lane,
  y,
  p95Tone,
  selected,
  onSelect,
}: {
  state: State;
  lane: LaneId;
  y: number;
  p95Tone: Tone;
  selected: boolean;
  onSelect: () => void;
}) {
  const L = s.lanes[lane];
  const info = LANE_INFO[lane];
  const top = y - LB.h / 2;
  const x = LB.x + 14;
  const right = LB.x + LB.w - 14;
  const p50 = percentile(L.stats.recent, 50);
  const p95 = percentile(L.stats.recent, 95);
  const d = L.last;

  return (
    <NodeBox id={lbNode(lane)} x={LB.x} y={top} w={LB.w} h={LB.h} selected={selected} onSelect={onSelect}>
      <text x={x} y={top + 23} className="fill-fg-muted text-svg-body">
        nginx upstream
      </text>
      <text x={right} y={top + 23} textAnchor="end" className="fill-fg-muted font-mono text-svg-body">
        {info.directive}
      </text>
      <text x={x} y={top + 47} className="fill-fg text-svg-title font-semibold">
        {info.title}
      </text>

      <text x={x} y={top + 76} className="fill-fg font-mono text-svg-body">
        {d ? (d.server === null ? `#${d.req} → 502` : `#${d.req} → ${serverLabel(d.server)}`) : "waiting for a request"}
      </text>
      <text x={x} y={top + 96} className="text-svg-body" fill={d?.server === null ? toneColor.err : toneColor.muted}>
        {d ? d.why : ""}
      </text>

      <text x={x} y={top + 125} className="fill-fg-muted font-mono text-svg-body">
        <title>{glossaryTitles("p50 p95")}</title>
        p50 <tspan className="fill-fg">{p50 === null ? "—" : secs(p50)}</tspan> p95{" "}
        <tspan fill={p95Tone === "muted" ? undefined : toneColor[p95Tone]} className={p95Tone === "muted" ? "fill-fg" : undefined}>
          {p95 === null ? "—" : secs(p95)}
        </tspan>
      </text>
      <text x={x} y={top + 148} className="fill-fg-muted font-mono text-svg-body">
        ok <tspan className="fill-fg">{L.stats.ok}</tspan> 5xx{" "}
        <tspan className={L.stats.errors ? "fill-err" : "fill-fg"}>{L.stats.errors}</tspan> retry{" "}
        <tspan className={L.stats.retries ? "fill-warn" : "fill-fg"}>{L.stats.retries}</tspan>
      </text>
    </NodeBox>
  );
}
