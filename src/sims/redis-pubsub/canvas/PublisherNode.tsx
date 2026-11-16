import { NodeBox } from "@/components/canvas";
import { cx, toneFill } from "@/components/ui";
import { glossaryTitle } from "@/lib/glossary";
import type { Publisher } from "../model";
import { CHANNEL_COLOR } from "../theme";
import { PUB } from "./layout";

/** A publishing service: its channel and rate, and the last PUBLISH reply it got. */
export function PublisherNode({
  pub: p,
  y: cy,
  now,
  selected,
  onSelect,
}: {
  pub: Publisher;
  y: number;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const y = cy - PUB.h / 2;
  const r = p.lastReply;
  const fresh = r && now - r.at < 700;
  const tone = !r ? "muted" : r.error ? "err" : r.text === "(integer) 0" ? "warn" : "ok";
  return (
    <NodeBox id={p.id} x={PUB.x} y={y} w={PUB.w} h={PUB.h} selected={selected} onSelect={onSelect}>
      <text x={PUB.x + 14} y={y + 26} className="fill-fg-muted text-svg-body">
        publisher
      </text>
      <text x={PUB.x + PUB.w - 14} y={y + 26} textAnchor="end" className="fill-fg-muted font-mono text-svg-body">
        {p.auto ? `${p.intervalMs}ms` : "paused"}
      </text>
      <text x={PUB.x + 14} y={y + 52} className="fill-fg text-svg-title font-semibold">
        {p.label}
      </text>
      <circle cx={PUB.x + 20} cy={y + 74} r={5.5} fill={CHANNEL_COLOR[p.channel]} />
      <text x={PUB.x + 32} y={y + 79} className="fill-fg font-mono text-svg-body">
        {p.channel}
      </text>
      <text
        x={PUB.x + 14}
        y={y + 108}
        className={cx("font-mono text-svg-body", toneFill[tone])}
        opacity={fresh ? 1 : 0.7}
      >
        {r?.error && <title>{glossaryTitle(r.text.split(" ").pop()!)}</title>}
        {/* Full error text is in the inspector; the card only has room for the code. */}
        {!r ? "← (no reply yet)" : r.error ? `← ${r.text.split(" ").pop()}` : `← ${r.text}`}
      </text>
    </NodeBox>
  );
}
