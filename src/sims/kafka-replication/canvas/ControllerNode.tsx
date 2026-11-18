import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { glossaryTitles } from "@/lib/glossary";
import { BROKERS, brokerLabel, CONTROLLER, list, PARTITION, secs, type State } from "../model";
import { CTL } from "./layout";

/** The KRaft controller: who leads orders-0, the epoch, the ISR and ELR it has committed, and each broker's session. */
export function ControllerNode({ state: s, now, selected, onSelect }: { state: State; now: number; selected: boolean; onSelect: () => void }) {
  const { x, y, w, h } = CTL;
  const c = s.ctl;
  const lx = x + 16;
  const cellW = 112;
  const cellsX = x + w - 16 - cellW * 3;
  return (
    <NodeBox id={CONTROLLER} x={x} y={y} w={w} h={h} selected={selected} onSelect={onSelect}>
      <text x={lx} y={y + 30} className="fill-fg text-svg-title font-semibold">
        controller
      </text>
      <text x={lx + 108} y={y + 30} className="fill-fg-muted text-svg-body">
        KRaft
      </text>
      <text x={lx + 150} y={y + 30} className="fill-fg-muted font-mono text-svg-body">
        {PARTITION} leader{" "}
        <tspan fill={c.leader === null ? toneColor.err : toneColor.accent} className="font-semibold">
          {c.leader === null ? "none (offline)" : brokerLabel(c.leader)}
        </tspan>{" "}
        · epoch <tspan className="fill-fg">{c.epoch}</tspan>
      </text>
      <text x={lx} y={y + 62} className="fill-fg-muted font-mono text-svg-body">
        <title>{glossaryTitles("ISR ELR")}</title>
        ISR <tspan className="fill-fg">{list(c.isr)}</tspan> · ELR <tspan className="fill-fg">{list(c.elr)}</tspan> · unclean.leader.election.enable=
        {s.settings.unclean === 1 ? "true" : "false"}
      </text>
      {BROKERS.map((b, k) => {
        const cx = cellsX + k * cellW;
        const fenced = c.fenced[b];
        const age = now - c.lastHb[b];
        return (
          <g key={b}>
            <text x={cx} y={y + 30} className="fill-fg-muted text-svg-body">
              {brokerLabel(b)}
            </text>
            <text x={cx} y={y + 62} className="font-mono text-svg-body" fill={fenced ? toneColor.err : age > s.settings.sessionMs * 0.5 ? toneColor.warn : toneColor.ok}>
              {fenced ? "fenced" : `hb ${secs(Math.max(0, age))} ago`}
            </text>
          </g>
        );
      })}
    </NodeBox>
  );
}
