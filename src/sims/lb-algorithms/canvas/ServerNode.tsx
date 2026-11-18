import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { srvNode, weightOf, type LaneId, type State } from "../model";
import { peerView, reqColor, serverCondition } from "../theme";
import { SRV } from "./layout";

const SLOT_W = 40;
const SLOT_GAP = 4;
const CHIP = 10.5;

/**
 * One backend server in one group: its condition (shared by all groups), how nginx sees it
 * (active connections or disabled), its workers with the request each is handling, and its queue.
 */
export function ServerNode({
  state: s,
  lane,
  i,
  y,
  now,
  selected,
  onSelect,
}: {
  state: State;
  lane: LaneId;
  i: number;
  y: number;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const top = y - SRV.h / 2;
  const x = SRV.x + 14;
  const srv = s.servers[i];
  const b = s.lanes[lane].backends[i];
  const cond = serverCondition(s, i);
  const view = peerView(s, lane, i, now);
  const workers = s.settings.workers;
  const chipsX = x + workers * (SLOT_W + SLOT_GAP) + 8;
  const maxChips = Math.floor((SRV.x + SRV.w - 104 - chipsX) / CHIP);
  const chips = b.queue.slice(0, maxChips);
  const w = weightOf(s, i);

  return (
    <NodeBox id={srvNode(lane, i)} x={SRV.x} y={top} w={SRV.w} h={SRV.h} rx={10} selected={selected} alert={srv.crashed} onSelect={onSelect}>
      <text x={x} y={top + 20} className="fill-fg text-svg-strong font-semibold">
        {srv.label}
      </text>
      <text x={x + 62} y={top + 20} className="text-svg-body" fill={toneColor[cond.tone]}>
        ● {cond.text}
        {w !== 1 && <tspan className="fill-fg-muted font-mono"> · weight={w}</tspan>}
      </text>
      <text x={SRV.x + SRV.w - 14} y={top + 20} textAnchor="end" className="font-mono text-svg-body" fill={toneColor[view.tone === "muted" ? "muted" : view.tone]}>
        {view.text}
      </text>

      {/* workers: each slot fills as its request is handled */}
      {Array.from({ length: workers }, (_, k) => {
        const job = b.working[k];
        const sx = x + k * (SLOT_W + SLOT_GAP);
        const f =
          job && job.startedAt !== null && job.endsAt !== null
            ? job.remaining !== null
              ? 1 - job.remaining / Math.max(1, job.endsAt - job.startedAt)
              : Math.min(1, (now - job.startedAt) / Math.max(1, job.endsAt - job.startedAt))
            : 0;
        return (
          <g key={k}>
            <rect x={sx} y={top + 30} width={SLOT_W} height={14} rx={3} className="fill-bg stroke-line" />
            {job && <rect x={sx} y={top + 30} width={SLOT_W * Math.max(0.08, f)} height={14} rx={3} fill={reqColor(job.heavy)} opacity={0.75} />}
          </g>
        );
      })}

      {/* queue: requests waiting for a free worker */}
      {chips.map((j, k) => (
        <rect key={j.att} x={chipsX + k * CHIP} y={top + 30} width={8} height={14} rx={2} fill={reqColor(j.heavy)} opacity={0.85} />
      ))}
      {b.queue.length > chips.length && (
        <text x={chipsX + chips.length * CHIP + 2} y={top + 42} className="fill-fg-muted font-mono text-svg-body">
          +{b.queue.length - chips.length}
        </text>
      )}

      <text x={SRV.x + SRV.w - 14} y={top + 42} textAnchor="end" className="fill-fg-muted font-mono text-svg-body">
        done {b.done}
      </text>
    </NodeBox>
  );
}
