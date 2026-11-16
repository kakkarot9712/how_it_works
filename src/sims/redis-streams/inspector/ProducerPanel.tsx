"use client";

import { InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Slider, Stat, StatGrid, Toggle } from "@/components/ui";
import { STREAM_KEY, type Action, type State } from "../model";

/** The producer: XADD by hand (including a poison entry and a burst), traffic controls, and its replies. */
export function ProducerPanel({ s, id, dispatch }: { s: State; id: string; dispatch: (a: Action) => void }) {
  const p = s.producers[id];
  return (
    <div>
      <InspectorHeader kind="producer" title={p.label} status={<Pill tone={p.auto ? "ok" : "muted"}>{p.auto ? "producing" : "paused"}</Pill>} />
      <Section title="Add by hand">
        <div className="flex flex-wrap gap-1.5">
          <Button onClick={() => dispatch({ type: "xadd", prod: id })}>XADD {STREAM_KEY}</Button>
          <Button onClick={() => dispatch({ type: "burst", prod: id, n: 10 })}>Burst of 10</Button>
          <Button tone="danger" onClick={() => dispatch({ type: "xadd", prod: id, poison: true })}>
            XADD a malformed order
          </Button>
        </div>
        <Help>The malformed order crashes the mailers&apos; handler. analytics only counts it.</Help>
      </Section>
      <Section title="Traffic">
        <Toggle label="Auto-produce" checked={p.auto} onChange={(on) => dispatch({ type: "set-auto", prod: id, on })} />
        <Slider
          label="Interval"
          value={p.intervalMs}
          min={150}
          max={2000}
          step={50}
          unit="ms"
          help="Faster than the consumers can process, and lag grows."
          onChange={(ms) => dispatch({ type: "set-interval", prod: id, ms })}
        />
      </Section>
      <Section title="Stats">
        <StatGrid>
          <Stat label="sent" value={p.sent} />
          <Stat label="failed" value={p.failed} tone={p.failed ? "err" : undefined} />
          <Stat label="last reply" value={p.lastReply?.error ? "ECONNREFUSED" : (p.lastReply?.text ?? "—")} tone={p.lastReply?.error ? "err" : undefined} />
        </StatGrid>
        <Help>
          XADD replies with the new entry&apos;s ID. The producer never waits for consumers: the entry is stored whether or
          not anyone reads it.
        </Help>
      </Section>
    </div>
  );
}
