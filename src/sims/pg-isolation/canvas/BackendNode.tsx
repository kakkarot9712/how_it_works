import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { backendNode, type Session } from "../model";
import { backendLines, SESSION_COLOR } from "../theme";
import { BE, WIRE_Y } from "./layout";

/** The server process serving one session: its pg_stat_activity state and, while blocked, what it waits for. */
export function BackendNode({ s, now, deadlockMs, selected, onSelect }: { s: Session; now: number; deadlockMs: number; selected: boolean; onSelect: () => void }) {
  const { x, w, h } = BE;
  const top = WIRE_Y[s.id] - h / 2;
  const state = backendLines(s.backend);
  const tone = s.backend === "idle in transaction (aborted)" ? "err" : s.wait ? "warn" : s.backend === "idle" ? "muted" : "ok";
  const waited = s.wait ? now - s.wait.since : 0;
  return (
    <NodeBox id={backendNode(s.id)} x={x} y={top} w={w} h={h} surface="panel-2" rx={10} selected={selected} alert={!s.connected} onSelect={onSelect}>
      <rect x={x} y={top + 10} width={4} height={30} rx={2} fill={SESSION_COLOR[s.id]} />
      <text x={x + 14} y={top + 24} className="fill-fg-muted text-svg-body">
        backend
      </text>
      <text x={x + 14} y={top + 44} className="fill-fg font-mono text-svg-strong">
        {s.connected ? `pid ${s.pid}` : "terminated"}
      </text>
      {s.connected &&
        state.map((line, i) => (
          <text key={i} x={x + 14} y={top + 70 + i * 18} className="font-mono text-svg-body" fill={toneColor[tone]}>
            {line}
          </text>
        ))}
      {s.wait && (
        <>
          <text x={x + 14} y={top + 108} className="fill-warn font-mono text-svg-body">
            Lock:
          </text>
          <text x={x + 14} y={top + 126} className="fill-warn font-mono text-svg-body">
            transactionid
          </text>
          <text x={x + 14} y={top + 150} className="fill-fg-muted font-mono text-svg-body">
            {(waited / 1000).toFixed(1)}s / {deadlockMs / 1000}s
          </text>
        </>
      )}
    </NodeBox>
  );
}
