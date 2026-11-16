import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { BLOCK_MS, type Consumer, type State } from "../model";
import { consumerStatus, GROUP_COLOR } from "../theme";
import { CONS } from "./layout";

/** A consumer process: status, what its connection is doing, its local batch, the entry it's processing, and counters. */
export function ConsumerNode({
  state: s,
  c,
  y: cy,
  now,
  selected,
  onSelect,
}: {
  state: State;
  c: Consumer;
  y: number;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { x, w, h } = CONS;
  const top = cy - h / 2;
  const st = consumerStatus(c);
  const col = x + 58;
  const slots = s.settings.count;
  const barW = w - 72;
  const step = Math.min(42, barW / slots);
  const procF = c.processing ? Math.min(1, 1 - (c.procEnds - now) / c.processMs) : 0;
  const conn =
    c.status !== "running"
      ? ""
      : c.blockedSince !== null
        ? `BLOCK ${((now - c.blockedSince) / 1000).toFixed(1)}s/${BLOCK_MS / 1000}s`
        : c.reading
          ? `XREADGROUP ${c.history ? "0" : ">"}`
          : "";
  const off = c.status === "offline" || c.status === "crashed";

  return (
    <NodeBox id={c.id} x={x} y={top} w={w} h={h} selected={selected} alert={c.status === "crashed"} onSelect={onSelect}>
      <text x={x + 14} y={top + 25} className="fill-fg text-svg-title font-semibold">
        {c.label}
      </text>
      <circle cx={x + w - 20} cy={top + 19} r={5.5} fill={GROUP_COLOR[c.group]} />
      <text x={x + 14} y={top + 48} className="text-svg-body" fill={toneColor[st.tone]}>
        ● {st.text}
      </text>
      <text x={x + w - 14} y={top + 48} textAnchor="end" className="fill-fg-muted font-mono text-svg-caption">
        {conn}
      </text>

      <text x={x + 14} y={top + 74} className="fill-fg-muted text-svg-body">
        batch
      </text>
      {Array.from({ length: slots }, (_, i) => {
        const d = c.queue[i];
        return (
          <g key={i}>
            <rect
              x={col + i * step}
              y={top + 60}
              width={step - 4}
              height={19}
              rx={3}
              className={d ? undefined : "fill-bg stroke-line"}
              fill={d ? (d.poison && s.groups[c.group].crashOnPoison ? toneColor.err : GROUP_COLOR[c.group]) : undefined}
              opacity={d ? 0.85 : 1}
            />
            {d && (
              <text x={col + i * step + (step - 4) / 2} y={top + 74} textAnchor="middle" className="fill-bg font-mono text-svg-caption">
                {d.order}
              </text>
            )}
          </g>
        );
      })}
      {c.queue.length > slots && (
        <text x={x + w - 12} y={top + 74} textAnchor="end" className="fill-fg-muted font-mono text-svg-caption">
          +{c.queue.length - slots}
        </text>
      )}

      <text x={x + 14} y={top + 99} className="fill-fg-muted text-svg-body">
        app
      </text>
      <rect x={col} y={top + 85} width={barW} height={19} rx={4} className="fill-bg stroke-line" />
      {c.processing && (
        <>
          <rect x={col} y={top + 85} width={barW * procF} height={19} rx={4} fill={GROUP_COLOR[c.group]} opacity={0.5} />
          <text x={col + 6} y={top + 99} className="fill-fg font-mono text-svg-caption">
            {c.processing.deliveries > 1 ? `#${c.processing.order} (delivery ${c.processing.deliveries})` : `order ${c.processing.order}`}
          </text>
        </>
      )}
      {c.hung && (
        <text x={col + barW - 6} y={top + 99} textAnchor="end" className="fill-warn font-mono text-svg-caption">
          ❚❚ hung
        </text>
      )}
      {off && (
        <text x={col + 6} y={top + 99} className="fill-err font-mono text-svg-caption">
          {c.status === "offline" ? "process not running" : "process exited"}
        </text>
      )}

      <text x={x + 14} y={top + 120} className="fill-fg-muted font-mono text-svg-body">
        done <tspan className="fill-fg">{c.done}</tspan> dup <tspan className={c.dups ? "fill-warn" : "fill-fg"}>{c.dups}</tspan> crashes{" "}
        <tspan className={c.crashes ? "fill-err" : "fill-fg"}>{c.crashes}</tspan>
      </text>
    </NodeBox>
  );
}
