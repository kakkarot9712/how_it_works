import { NodeBox } from "@/components/canvas";
import { cx, toneFill } from "@/components/ui";
import { glossaryTitle } from "@/lib/glossary";
import { STREAM_KEY, type Producer, type State } from "../model";
import { PROD } from "./layout";

/** The producing service: its XADD command and rate, and the last reply (the new entry's ID, or an error). */
export function ProducerNode({
  state: s,
  prod: p,
  now,
  selected,
  onSelect,
}: {
  state: State;
  prod: Producer;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { x, y, w, h } = PROD;
  const r = p.lastReply;
  const fresh = r && now - r.at < 700;
  const tone = !r ? "muted" : r.error ? "err" : "ok";
  return (
    <NodeBox id={p.id} x={x} y={y} w={w} h={h} selected={selected} onSelect={onSelect}>
      <text x={x + 14} y={y + 24} className="fill-fg-muted text-svg-body">
        producer
      </text>
      <text x={x + w - 14} y={y + 24} textAnchor="end" className="fill-fg-muted font-mono text-svg-body">
        {p.auto ? `${p.intervalMs}ms` : "paused"}
      </text>
      <text x={x + 14} y={y + 50} className="fill-fg text-svg-title font-semibold">
        {p.label}
      </text>
      <text x={x + 14} y={y + 76} className="fill-fg font-mono text-svg-body">
        XADD {STREAM_KEY}
      </text>
      <text x={x + 30} y={y + 96} className="fill-fg font-mono text-svg-body">
        {s.components.maxlen ? `MAXLEN ${s.settings.maxLen} *` : "*"}
      </text>
      <text x={x + 14} y={y + 122} className={cx("font-mono text-svg-body", toneFill[tone])} opacity={fresh ? 1 : 0.7}>
        {r?.error && <title>{glossaryTitle("ECONNREFUSED")}</title>}
        {!r ? "← (no reply yet)" : r.error ? "← ECONNREFUSED" : `← ${r.text}`}
      </text>
      <text x={x + 14} y={y + 148} className="fill-fg-muted font-mono text-svg-body">
        sent <tspan className="fill-fg">{p.sent}</tspan> failed <tspan className={p.failed ? "fill-err" : "fill-fg"}>{p.failed}</tspan>
      </text>
    </NodeBox>
  );
}
