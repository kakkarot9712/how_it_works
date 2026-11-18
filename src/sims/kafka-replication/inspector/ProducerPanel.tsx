"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, SegmentedControl, Slider, Stat, StatGrid, Toggle } from "@/components/ui";
import { acksLabel, DELIVERY_TIMEOUT_MS, idempotent, MAX_IN_FLIGHT, secs, type Acks, type Action, type State } from "../model";

const ACKS: Acks[] = [0, 1, -1];

/** The producer: drive it, switch acks, and see what happened to its records. */
export function ProducerPanel({ s, dispatch }: { s: State; dispatch: (a: Action) => void }) {
  const p = s.producer;
  const count = (st: string) => p.records.filter((r) => r.status === st && !r.lost).length;
  const lost = p.records.filter((r) => r.lost).length;
  const idem = idempotent(s, p.acks);
  return (
    <div>
      <InspectorHeader kind="client" title="producer" status={<Pill tone={p.on ? "ok" : "muted"}>{p.on ? "sending" : "paused"}</Pill>} />
      <Section title="Drive it">
        <Toggle label="Send records" help="One record per Produce request, to the leader." checked={p.on} onChange={(on) => dispatch({ type: "set-producing", on })} />
        <Slider
          label="Gap between records"
          value={p.intervalMs}
          min={200}
          max={1500}
          step={50}
          unit="ms"
          help="Shorter gaps put more records in flight at once."
          onChange={(ms) => dispatch({ type: "set-interval", ms })}
        />
        <div className="mt-3">
          <SegmentedControl label="acks" options={ACKS} value={p.acks} format={(a) => `acks=${acksLabel(a)}`} onChange={(acks) => dispatch({ type: "set-acks", acks })} />
        </div>
        <Help>
          acks=0: no answer at all. acks=1: the leader answers once the record is in its own log. acks=all: once every in-sync replica has it.
        </Help>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button onClick={() => dispatch({ type: "burst", n: 5 })}>Send 5 records now</Button>
        </div>
      </Section>
      <Section title="Stats">
        <StatGrid cols={3}>
          <Stat label="acked" value={count("acked")} />
          <Stat label="sent, no ack" value={count("sent")} />
          <Stat label="lost" value={lost} tone={lost ? "err" : undefined} />
          <Stat label="failed" value={count("failed")} tone={count("failed") ? "err" : undefined} />
          <Stat label="retries" value={p.retries} tone={p.retries ? "warn" : undefined} />
          <Stat label="in flight" value={`${p.inflight.length}/${MAX_IN_FLIGHT}`} />
        </StatGrid>
        {s.duplicates > 0 && <Help>{s.duplicates} record(s) were written twice: a resend without idempotence.</Help>}
      </Section>
      <Section title="Config">
        <ConfigLine>{[`acks=${acksLabel(p.acks)}`, `enable.idempotence=${idem}`, `retries=${s.components.retries ? 2147483647 : 0}`].join("\n")}</ConfigLine>
        <Help>
          lost: the producer was told the record was written (or, with acks=0, sent it), but the current leader doesn&apos;t have it. Retries stop after delivery.timeout.ms ({secs(DELIVERY_TIMEOUT_MS)} here).
        </Help>
      </Section>
    </div>
  );
}
