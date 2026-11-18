import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { acksLabel, brokerLabel, idempotent, MAX_IN_FLIGHT, PRODUCER, type State } from "../model";
import { recordView } from "../theme";
import { PROD } from "./layout";

const ROW = 22;

/** The producer: its settings, where its metadata says the leader is, counters, and its newest records with their fate. */
export function ProducerNode({ state: s, selected, onSelect }: { state: State; selected: boolean; onSelect: () => void }) {
  const { x, y, w, h } = PROD;
  const p = s.producer;
  const lx = x + 14;
  const rx = x + w - 14;
  const lost = p.records.filter((r) => r.lost).length;
  const failed = p.records.filter((r) => r.status === "failed").length;
  const acked = p.records.filter((r) => r.status === "acked" && !r.lost).length;
  const listTop = y + 284;
  const rowsFit = Math.floor((y + h - 12 - listTop) / ROW);
  const shown = [...p.records].reverse().slice(0, rowsFit);
  const stat = (label: string, value: number, row: number, tone?: "err" | "warn", shown: string = String(value)) => (
    <text x={lx} y={y + 118 + row * 22} className="fill-fg-muted text-svg-body">
      {label}
      <tspan x={rx} textAnchor="end" className={tone && value > 0 ? "font-mono" : "fill-fg font-mono"} fill={tone && value > 0 ? toneColor[tone] : undefined}>
        {shown}
      </tspan>
    </text>
  );

  return (
    <NodeBox id={PRODUCER} x={x} y={y} w={w} h={h} selected={selected} onSelect={onSelect}>
      <text x={lx} y={y + 28} className="fill-fg text-svg-title font-semibold">
        producer
      </text>
      <text x={lx} y={y + 52} className="fill-fg font-mono text-svg-body">
        acks={acksLabel(p.acks)}
      </text>
      <text x={lx} y={y + 72} className="fill-fg-muted text-svg-body">
        idempotence {idempotent(s, p.acks) ? "on" : "off"}
      </text>
      <text x={lx} y={y + 96} className="fill-fg-muted text-svg-body">
        leader: <tspan className="fill-fg">{p.meta.leader === null ? "none" : brokerLabel(p.meta.leader)}</tspan>
      </text>
      {stat("in flight", p.inflight.length, 0, undefined, `${p.inflight.length}/${MAX_IN_FLIGHT}`)}
      {stat("buffered", p.buffer.length, 1, "warn")}
      {stat("acked", acked, 2)}
      {stat("retries", p.retries, 3, "warn")}
      {stat("failed", failed, 4, "err")}
      {stat("lost", lost, 5, "err")}
      {s.duplicates > 0 && stat("duplicates", s.duplicates, 6, "err")}

      <text x={lx} y={listTop - 14} className="fill-fg-muted text-svg-body">
        newest records
      </text>
      {shown.map((r, k) => {
        const v = recordView(r);
        const ry = listTop + k * ROW + 14;
        return (
          <g key={r.id}>
            <text x={lx} y={ry} className="fill-fg font-mono text-svg-body">
              r{r.id}
            </text>
            {r.offset !== null && (
              <text x={lx + 44} y={ry} className="fill-fg-muted font-mono text-svg-body">
                @{r.offset}
              </text>
            )}
            <text x={rx} y={ry} textAnchor="end" className="text-svg-body" fill={toneColor[v.tone]}>
              {v.text}
            </text>
          </g>
        );
      })}
    </NodeBox>
  );
}
