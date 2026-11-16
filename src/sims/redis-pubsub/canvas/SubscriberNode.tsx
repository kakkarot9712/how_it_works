import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import type { State, Subscriber } from "../model";
import { CHANNEL_COLOR, subStatus } from "../theme";
import { SUB } from "./layout";

/** A subscribing client: status, its SUBSCRIBE command, kernel socket buffer slots, the app handling a message, and counters. */
export function SubscriberNode({
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
  const top = y - SUB.h / 2;
  const x = SUB.x + 14;
  const col = SUB.x + 100;
  const st = subStatus(sub);
  const cmd = [...(sub.channels.length ? [`SUBSCRIBE ${sub.channels.join(" ")}`] : []), ...(sub.patterns.length ? [`PSUBSCRIBE ${sub.patterns.join(" ")}`] : [])].join(" ");
  const slots = s.settings.window;
  const step = Math.min(19, (SUB.w - 114) / slots);
  const procF = sub.processing ? Math.min(1, 1 - (sub.processingEnds - now) / sub.processMs) : 0;

  return (
    <NodeBox id={sub.id} x={SUB.x} y={top} w={SUB.w} h={SUB.h} selected={selected} onSelect={onSelect}>
      <text x={x} y={top + 29} className="fill-fg text-svg-title font-semibold">
        {sub.label}
      </text>
      <text x={x} y={top + 51} className="text-svg-body" fill={toneColor[st.tone]}>
        ● {st.text}
      </text>
      <text x={x} y={top + 73} className="fill-fg-muted font-mono text-svg-body">
        {cmd}
      </text>

      {/* kernel socket buffer: unread data that already arrived */}
      <text x={x} y={top + 104} className="fill-fg-muted text-svg-body">
        socket buf
      </text>
      {Array.from({ length: slots }, (_, i) => {
        const m = sub.rx[i];
        return (
          <rect
            key={i}
            x={col + i * step}
            y={top + 91}
            width={step - 3}
            height={16}
            rx={3}
            className={m ? undefined : "fill-bg stroke-line"}
            fill={m ? CHANNEL_COLOR[m.channel] : undefined}
          />
        );
      })}

      {/* the app reading/processing one message */}
      <text x={x} y={top + 132} className="fill-fg-muted text-svg-body">
        app
      </text>
      <rect x={col} y={top + 118} width={SUB.w - 114} height={19} rx={4} className="fill-bg stroke-line" />
      {sub.processing && (
        <>
          <rect x={col} y={top + 118} width={(SUB.w - 114) * procF} height={19} rx={4} fill={CHANNEL_COLOR[sub.processing.channel]} opacity={0.5} />
          <text x={col + 6} y={top + 132} className="fill-fg font-mono text-svg-caption">
            {sub.processing.payload}
          </text>
        </>
      )}
      {sub.blocked && (
        <text x={col + 6} y={top + 132} className="fill-warn font-mono text-svg-caption">
          ⏸ not reading
        </text>
      )}

      <text x={x} y={top + 164} className="fill-fg-muted font-mono text-svg-body">
        recv <tspan className="fill-fg">{sub.received}</tspan> missed{" "}
        <tspan className={sub.missed ? "fill-warn" : "fill-fg"}>{sub.missed}</tspan> lost{" "}
        <tspan className={sub.lost ? "fill-err" : "fill-fg"}>{sub.lost}</tspan>
      </text>
      <text x={x} y={top + 189} className="fill-fg-muted font-mono text-svg-body">
        {sub.recent.length ? `last: ${sub.recent[0].label}` : "last: —"}
      </text>
    </NodeBox>
  );
}
