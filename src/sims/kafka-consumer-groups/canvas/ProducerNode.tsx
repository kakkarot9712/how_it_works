import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { HOT_KEY, KEYS, partId, partitionForKey, PRODUCER, STICKY_RECORDS, TOPIC, type State } from "../model";
import { PROD } from "./layout";

/** The producer: how it picks partitions, the key → partition map, and its newest sends. */
export function ProducerNode({ state: s, selected, onSelect }: { state: State; selected: boolean; onSelect: () => void }) {
  const { x, y, w, h } = PROD;
  const lx = x + 14;
  const pr = s.producer;
  const keyed = s.components.keyPartitioning;
  const listTop = y + 300;

  return (
    <NodeBox id={PRODUCER} x={x} y={y} w={w} h={h} selected={selected} onSelect={onSelect}>
      <text x={lx} y={y + 28} className="fill-fg text-svg-title font-semibold">
        producer
      </text>
      <text x={lx} y={y + 52} className="fill-fg-muted text-svg-body">
        topic <tspan className="fill-fg font-mono">{TOPIC}</tspan>
      </text>
      <text x={lx} y={y + 82} className="fill-fg-muted text-svg-body">
        partitioner
      </text>
      <text x={lx} y={y + 102} className="fill-fg font-mono text-svg-body">
        {keyed ? "murmur2(key) % 3" : "keys ignored"}
      </text>
      {keyed ? (
        [0, 1, 2].map((p) => (
          <text key={p} x={lx} y={y + 128 + p * 22} className="fill-fg-muted font-mono text-svg-body">
            {KEYS.filter((k) => partitionForKey(k) === p).join(" ")} <tspan className="fill-fg">→ p{p}</tspan>
          </text>
        ))
      ) : (
        <text x={lx} y={y + 128} className="fill-fg-muted text-svg-body">
          sticky: {STICKY_RECORDS} per batch
        </text>
      )}
      <text x={lx} y={y + 214} className="fill-fg-muted text-svg-body">
        sent <tspan className="fill-fg font-mono">{pr.sent}</tspan>
      </text>
      <text x={lx} y={y + 236} className="fill-fg-muted text-svg-body">
        every <tspan className="fill-fg font-mono">{(s.settings.produceEveryMs / 1000).toFixed(2)} s</tspan>
      </text>
      {s.settings.hotKeyPct > 0 && (
        <text x={lx} y={y + 258} className="text-svg-body" fill={toneColor.warn}>
          {HOT_KEY}: {s.settings.hotKeyPct}% of records
        </text>
      )}
      <text x={lx} y={listTop - 12} className="fill-fg-muted text-svg-body">
        newest
      </text>
      {pr.recent.map((r, i) => (
        <text key={i} x={lx} y={listTop + 12 + i * 22} className="font-mono text-svg-body" fill={r.poison ? toneColor.err : undefined}>
          <tspan className={r.poison ? undefined : "fill-fg"}>{r.poison ? `${r.key} ✕` : r.key}</tspan>
          <tspan className="fill-fg-muted"> → {partId(r.p)}</tspan>
        </text>
      ))}
    </NodeBox>
  );
}
