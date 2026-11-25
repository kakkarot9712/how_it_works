"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Stat, StatGrid } from "@/components/ui";
import { KEY_FOR_PARTITION, partId, PARTITIONS, type Action, type State } from "../model";

export function ProducerPanel({ s, dispatch }: { s: State; dispatch: (a: Action) => void }) {
  const keyed = s.components.keyPartitioning;
  return (
    <div>
      <InspectorHeader kind="producer" title="producer" status={<Pill tone="ok">sending</Pill>} />
      <Section title="Drive it">
        <div className="flex flex-wrap gap-1.5">
          <Button onClick={() => dispatch({ type: "burst", n: 10 })}>Send a burst of 10</Button>
          {PARTITIONS.map((p) => (
            <Button key={p} tone="danger" onClick={() => dispatch({ type: "poison", p })}>
              Poison record → {partId(p)}
            </Button>
          ))}
        </div>
        <Help>A poison record is one the consumer code throws on (key {KEY_FOR_PARTITION.join(", ")} for partitions 0, 1, 2). Kafka stores it like any other record.</Help>
      </Section>
      <Section title="Stats">
        <StatGrid cols={3}>
          <Stat label="sent" value={s.producer.sent} />
          <Stat label="out of order" value={s.outOfOrder} tone={s.outOfOrder ? "warn" : undefined} />
          <Stat label="lost" value={s.lost} tone={s.lost ? "err" : undefined} />
        </StatGrid>
      </Section>
      <Section title="Config">
        <ConfigLine>{keyed ? "partitioner.ignore.keys=false\n# partition = murmur2(key) % 3" : "partitioner.ignore.keys=true\n# sticky partition per batch"}</ConfigLine>
        <Help>
          {keyed
            ? "Records with the same key always land on the same partition, so their order is kept. Turn off the Partition by key block to see what happens without it."
            : "Keys are ignored: one key's records spread over all partitions and are processed in parallel, out of order."}
        </Help>
      </Section>
    </div>
  );
}
