"use client";

import { InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Slider, Stat, StatGrid, Toggle } from "@/components/ui";
import type { Action, State } from "../model";

/** The traffic source: pause it, change the rate, or send bursts by hand. */
export function ClientsPanel({ s, dispatch }: { s: State; dispatch: (a: Action) => void }) {
  return (
    <div>
      <InspectorHeader kind="traffic" title="clients" status={<Pill tone={s.traffic.on ? "ok" : "muted"}>{s.traffic.on ? "sending" : "paused"}</Pill>} />
      <Section title="Drive it">
        <Toggle label="Send requests" help="A steady random stream, copied to all four groups." checked={s.traffic.on} onChange={(on) => dispatch({ type: "set-traffic", on })} />
        <Slider
          label="Average gap between requests"
          value={s.traffic.intervalMs}
          min={100}
          max={1500}
          step={10}
          unit="ms"
          help="Shorter gaps mean more load on the same three servers."
          onChange={(ms) => dispatch({ type: "set-interval", ms })}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button onClick={() => dispatch({ type: "burst", heavy: true, n: 3 })}>Send 3 heavy requests</Button>
          <Button onClick={() => dispatch({ type: "burst", heavy: false, n: 6 })}>Send 6 normal requests</Button>
        </div>
        <Help>
          A heavy request is {s.settings.heavyX}× the work of a normal one. Change the mix in Blocks &amp; settings.
        </Help>
      </Section>
      <Section title="Stats">
        <StatGrid>
          <Stat label="sent" value={s.traffic.sent} />
          <Stat label="heavy" value={s.traffic.heavy} />
        </StatGrid>
        <Help>Every request goes to all four nginx groups at the same moment, so each method faces exactly the same traffic.</Help>
      </Section>
    </div>
  );
}
