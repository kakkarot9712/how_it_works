import { Bar, NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { CHANNELS, derived, kb, RESTART_MS, SERVER, type State } from "../model";
import { CHANNEL_COLOR } from "../theme";
import { CORE } from "./layout";
import { glossaryTitle } from "@/lib/glossary";

/** redis-server's core: channel and pattern tables, client-buffer memory gauge, and a "PROCESS DOWN" overlay. */
export function ServerNode({ state: s, now, selected, onSelect }: { state: State; now: number; selected: boolean; onSelect: () => void }) {
  const mem = derived(s).memBytes;
  const cap = s.settings.headroomKb * 1024;
  const memF = Math.min(1, mem / cap);
  const memTone = memF > 0.85 ? "err" : memF > 0.5 ? "warn" : "ok";
  const patterns = s.subIds.flatMap((id) => (s.subscribers[id].registered ? s.subscribers[id].patterns.map((p) => [p, id]) : []));

  return (
    <NodeBox id={SERVER} x={CORE.x} y={CORE.y} w={CORE.w} h={CORE.h} selected={selected} alert={!s.server.up} onSelect={onSelect}>
      <text x={CORE.x + 16} y={CORE.y + 34} className="fill-fg text-svg-title font-semibold">
        redis-server
      </text>
      <text x={CORE.x + CORE.w - 16} y={CORE.y + 34} textAnchor="end" className={s.server.up ? "fill-ok text-svg-body" : "fill-err text-svg-body"}>
        {s.server.up ? "● up" : "● DOWN"}
      </text>

      <text x={CORE.x + 16} y={CORE.y + 70} className="fill-fg-muted text-svg-caption uppercase tracking-wider">
        pubsub channels
      </text>
      {CHANNELS.map((ch, i) => {
        const subs = s.subIds.filter((id) => s.subscribers[id].registered && s.subscribers[id].channels.includes(ch));
        return (
          <g key={ch} transform={`translate(${CORE.x + 16} ${CORE.y + 98 + i * 48})`}>
            <circle cx={6} cy={-5} r={5.5} fill={CHANNEL_COLOR[ch]} />
            <text x={20} y={0} className="fill-fg font-mono text-svg-strong">
              {ch}
            </text>
            <text x={20} y={20} className="fill-fg-muted text-svg-body">
              {subs.length ? `→ ${subs.map((id) => s.subscribers[id].label).join(", ")}` : "→ (nobody)"}
            </text>
          </g>
        );
      })}

      <text x={CORE.x + 16} y={CORE.y + 256} className="fill-fg-muted text-svg-caption uppercase tracking-wider">
        pubsub patterns
      </text>
      {patterns.length ? (
        patterns.map(([p, id], i) => (
          <text key={p + id} x={CORE.x + 16} y={CORE.y + 282 + i * 22} className="fill-fg font-mono text-svg-strong">
            {p} <tspan className="fill-fg-muted text-svg-body">→ {s.subscribers[id].label}</tspan>
          </text>
        ))
      ) : (
        <text x={CORE.x + 16} y={CORE.y + 282} className="fill-fg-muted text-svg-body">
          (none)
        </text>
      )}

      {/* memory gauge */}
      <g transform={`translate(${CORE.x + 16} ${CORE.y + CORE.h - 80})`}>
        <text className="fill-fg-muted text-svg-caption uppercase tracking-wider">
          <title>{glossaryTitle("RAM")}</title>
          client buffers in RAM
        </text>
        <Bar x={0} y={12} width={CORE.w - 32} height={12} rx={6} track="panel-2" value={memF} color={toneColor[memTone]} />
        <text y={46} className="fill-fg-muted font-mono text-svg-body">
          {kb(mem)} / {s.settings.headroomKb} KB headroom
        </text>
      </g>

      {!s.server.up && (
        <g>
          <rect x={CORE.x} y={CORE.y} width={CORE.w} height={CORE.h} rx={12} className="fill-bg/95" />
          <text x={CORE.x + CORE.w / 2} y={CORE.y + CORE.h / 2 - 8} textAnchor="middle" className="fill-err text-svg-display font-bold">
            PROCESS DOWN
          </text>
          <text x={CORE.x + CORE.w / 2} y={CORE.y + CORE.h / 2 + 18} textAnchor="middle" className="fill-fg-muted text-svg-body">
            {s.server.downSince !== null
              ? `restarting in ${Math.max(0, (s.server.downSince + RESTART_MS - now) / 1000).toFixed(1)}s`
              : ""}
          </text>
        </g>
      )}
    </NodeBox>
  );
}
