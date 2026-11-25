import { Bar, NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { COMMIT_MODES, consId, partId, type State } from "../model";
import { consumerStatus } from "../theme";
import { CONS, consTop } from "./layout";

/** One consumer: status, owned partitions, the record it's processing, and its poll timer against max.poll.interval.ms. */
export function ConsumerNode({ state: s, c, now, selected, onSelect }: { state: State; c: number; now: number; selected: boolean; onSelect: () => void }) {
  const { x, w, h } = CONS;
  const y = consTop(c);
  const k = s.consumers[c];
  const st = consumerStatus(s, c);
  const lx = x + 14;
  const rx = x + w - 14;
  const pr = k.processing;
  const pollAge = k.up ? Math.max(0, now - k.lastPollAt) : 0;
  const pollFrac = Math.min(1, pollAge / s.settings.maxPollIntervalMs);
  const procFrac = pr ? Math.min(1, Math.max(0, (now - pr.startedAt) / Math.max(1, pr.endsAt - pr.startedAt))) : 0;
  const rec = pr ? s.partitions[pr.p].log[pr.offset] : null;

  let doing = "waiting in poll()";
  if (!k.up) doing = k.crashed ? "process killed" : "–";
  else if (pr && rec) doing = pr.attempts > 1 ? `retrying ${partId(pr.p)}@${pr.offset} ×${pr.attempts}` : `processing ${partId(pr.p)}@${pr.offset} · ${rec.key}`;
  else if (k.committing) doing = "waiting for commitSync";

  return (
    <NodeBox id={consId(c)} x={x} y={y} w={w} h={h} selected={selected} alert={k.crashed} dim={!k.up && !k.crashed} onSelect={onSelect}>
      <text x={lx} y={y + 26} className="fill-fg font-mono text-svg-title font-semibold">
        {consId(c)}
      </text>
      <text x={rx} y={y + 26} textAnchor="end" className="text-svg-body" fill={toneColor[st.tone]}>
        ● {st.text}
      </text>
      <text x={lx} y={y + 50} className="fill-fg-muted text-svg-body">
        owns <tspan className="fill-fg font-mono">{k.up && k.owned.length ? k.owned.map(partId).join(", ") : "nothing"}</tspan>
      </text>
      <text x={lx} y={y + 74} className="text-svg-body" fill={pr && pr.attempts > 1 ? toneColor.err : undefined}>
        <tspan className={pr && pr.attempts > 1 ? undefined : "fill-fg-muted"}>{doing}</tspan>
      </text>
      <Bar x={lx} y={y + 82} width={w - 28} height={6} value={procFrac} color={pr && pr.attempts > 1 ? toneColor.err : "var(--color-ch-2)"} track="panel-2" />
      <text x={lx} y={y + 112} className="fill-fg-muted text-svg-body">
        since poll()
      </text>
      <Bar x={lx + 96} y={y + 104} width={170} height={8} value={pollFrac} color={pollFrac > 0.7 ? toneColor.err : toneColor.ok} track="panel-2" markers={[{ at: 1, color: toneColor.err }]} />
      <text x={rx} y={y + 112} textAnchor="end" className="fill-fg font-mono text-svg-body">
        {(pollAge / 1000).toFixed(1)} s
      </text>
      <text x={lx} y={y + 136} className="fill-fg-muted text-svg-body">
        batch <tspan className="fill-fg font-mono">{k.buffer.length + (pr ? 1 : 0)}</tspan>
        {"   "}done <tspan className="fill-fg font-mono">{k.processedCount}</tspan>
        {"   "}twice{" "}
        <tspan className="font-mono" fill={k.dupCount ? toneColor.warn : undefined}>
          <tspan className={k.dupCount ? undefined : "fill-fg"}>{k.dupCount}</tspan>
        </tspan>
        {k.dlqCount > 0 && (
          <>
            {"   "}parked <tspan className="font-mono" fill={toneColor.warn}>{k.dlqCount}</tspan>
          </>
        )}
      </text>
      <text x={lx} y={y + 160} className="fill-fg-muted text-svg-caption">
        commit: {COMMIT_MODES[s.settings.commitMode]}
        {k.slow > 1 ? ` · ${k.slow}× slower` : ""}
      </text>
    </NodeBox>
  );
}
