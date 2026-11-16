import { Bar, NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { kb, type State, type Subscriber } from "../model";
import { CHANNEL_COLOR } from "../theme";
import { BUF } from "./layout";

/** One client's output buffer inside Redis: size bar with soft/hard limit markers, queued messages, soft-limit timer. */
export function OutputBufferNode({
  state: s,
  sub,
  y,
  now,
  selected,
  onSelect,
}: {
  state: State;
  sub: Subscriber;
  y: number;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const top = y - BUF.h / 2;
  const limits = s.components.limits;
  const hard = s.settings.hardKb * 1024;
  const soft = s.settings.softKb * 1024;
  const scale = limits ? hard * 1.12 : s.settings.headroomKb * 1024;
  const tone = limits
    ? sub.obufBytes > hard * 0.8
      ? "err"
      : sub.obufBytes > soft
        ? "warn"
        : "ok"
    : sub.obufBytes > scale * 0.6
      ? "err"
      : "ok";
  const chips = sub.obuf.slice(0, 18);

  return (
    <NodeBox x={BUF.x} y={top} w={BUF.w} h={BUF.h} rx={10} surface="panel-2" selected={selected} dim={!sub.registered} onSelect={onSelect}>
      <text x={BUF.x + 14} y={top + 25} className="fill-fg-muted text-svg-body">
        output buffer
      </text>
      <text x={BUF.x + BUF.w - 14} y={top + 25} textAnchor="end" className="fill-fg font-mono text-svg-body">
        {sub.registered ? `${kb(sub.obufBytes)} · ${sub.obuf.length} msg` : "closed"}
      </text>
      <Bar
        x={BUF.x + 14}
        y={top + 38}
        width={BUF.w - 28}
        value={sub.obufBytes / scale}
        color={toneColor[tone]}
        markers={
          limits
            ? [
                { at: soft / scale, color: toneColor.warn },
                { at: hard / scale, color: toneColor.err },
              ]
            : []
        }
      />
      <g transform={`translate(${BUF.x + 14} ${top + 63})`}>
        {chips.map((m, i) => (
          <rect key={m.id} x={i * 10.5} y={0} width={8} height={13} rx={2} fill={CHANNEL_COLOR[m.channel]} opacity={0.85} />
        ))}
        {sub.obuf.length > chips.length && (
          <text x={chips.length * 10.5 + 4} y={12} className="fill-fg-muted font-mono text-svg-body">
            +{sub.obuf.length - chips.length}
          </text>
        )}
      </g>
      <text x={BUF.x + 14} y={top + BUF.h - 12} className="text-svg-body" fill={sub.softSince !== null ? toneColor.warn : toneColor.muted}>
        {!limits
          ? "no limit configured"
          : sub.softSince !== null
            ? `over soft limit ${((now - sub.softSince) / 1000).toFixed(1)}s / ${s.settings.softSeconds}s`
            : `soft ${s.settings.softKb} KB · hard ${s.settings.hardKb} KB`}
      </text>
    </NodeBox>
  );
}
