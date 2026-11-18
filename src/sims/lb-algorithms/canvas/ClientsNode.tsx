import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { CLIENTS, type State } from "../model";
import { REQ_COLOR, reqColor } from "../theme";
import { CLI } from "./layout";

const ROW = 22;

/** The traffic source: one stream of requests, copied to all four groups at the same moment. */
export function ClientsNode({ state: s, now, selected, onSelect }: { state: State; now: number; selected: boolean; onSelect: () => void }) {
  const x = CLI.x + 14;
  const top = CLI.y;
  const listTop = top + 210;
  const fit = Math.floor((CLI.y + CLI.h - 16 - listTop) / ROW);
  const recent = s.recentReqs.slice(0, fit);
  return (
    <NodeBox id={CLIENTS} x={CLI.x} y={CLI.y} w={CLI.w} h={CLI.h} selected={selected} onSelect={onSelect}>
      <text x={x} y={top + 28} className="fill-fg text-svg-title font-semibold">
        clients
      </text>
      <text x={x} y={top + 50} className="text-svg-body" fill={s.traffic.on ? toneColor.ok : toneColor.muted}>
        ● {s.traffic.on ? "sending" : "paused"}
      </text>
      <text x={x} y={top + 74} className="fill-fg-muted text-svg-body">
        same requests
      </text>
      <text x={x} y={top + 92} className="fill-fg-muted text-svg-body">
        to all four groups
      </text>
      <text x={x} y={top + 120} className="fill-fg-muted font-mono text-svg-body">
        every ~{(s.traffic.intervalMs / 1000).toFixed(2)}s
      </text>
      <text x={x} y={top + 140} className="fill-fg-muted font-mono text-svg-body">
        heavy {s.settings.heavyPct}% ×{s.settings.heavyX}
      </text>

      <rect x={x} y={top + 156} width={8} height={13} rx={2} fill={REQ_COLOR.normal} />
      <text x={x + 14} y={top + 167} className="fill-fg-muted text-svg-body">
        normal
      </text>
      <rect x={x + 66} y={top + 156} width={8} height={13} rx={2} fill={REQ_COLOR.heavy} />
      <text x={x + 80} y={top + 167} className="fill-fg-muted text-svg-body">
        heavy
      </text>

      <text x={x} y={top + 198} className="fill-fg-muted text-svg-body">
        sent <tspan className="fill-fg font-mono">{s.traffic.sent}</tspan>
      </text>
      {recent.map((r, k) => (
        <text key={r.id} x={x} y={listTop + 14 + k * ROW} className="font-mono text-svg-body" fill={reqColor(r.heavy)} opacity={now - r.at < 600 ? 1 : 0.7}>
          #{r.id} {r.heavy ? "heavy" : "normal"}
        </text>
      ))}
    </NodeBox>
  );
}
