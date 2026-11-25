"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Stat, StatGrid } from "@/components/ui";
import { committedOf, consId, GROUP, KEYS, lagOf, leo, ownerOf, partId, partitionForKey, TOPIC, type Action, type State } from "../model";
import { lagTone } from "../theme";

export function PartitionPanel({ s, p, dispatch }: { s: State; p: number; dispatch: (a: Action) => void }) {
  const owner = ownerOf(s, p);
  const lag = lagOf(s, p);
  const log = s.partitions[p].log;
  const dup = log.filter((r) => r.processed > 1).length;
  const lost = log.filter((r) => r.lost).length;
  const ownerName = owner === null ? "-" : consId(owner);
  return (
    <div>
      <InspectorHeader kind="partition" title={partId(p)} status={owner === null ? <Pill tone="warn">no owner</Pill> : <Pill tone="ok">{ownerName}</Pill>} />
      <Section title="Drive it">
        <div className="flex flex-wrap gap-1.5">
          <Button tone="danger" onClick={() => dispatch({ type: "poison", p })}>
            Send a poison record here
          </Button>
        </div>
      </Section>
      <Section title="Stats">
        <StatGrid cols={3}>
          <Stat label="log end" value={leo(s, p)} />
          <Stat label="committed" value={committedOf(s, p)} />
          <Stat label="lag" value={lag} tone={lag ? lagTone(lag) : undefined} />
          <Stat label="twice" value={dup} tone={dup ? "warn" : undefined} />
          <Stat label="lost" value={lost} tone={lost ? "err" : undefined} />
          <Stat label="keys" value={s.components.keyPartitioning ? KEYS.filter((k) => partitionForKey(k) === p).join(" ") : "any"} />
        </StatGrid>
      </Section>
      <Section title="kafka-consumer-groups.sh --describe">
        <ConfigLine>{`TOPIC  PARTITION  CURRENT-OFFSET\n${TOPIC} ${p}          ${committedOf(s, p)}\nLOG-END-OFFSET  LAG\n${leo(s, p)}              ${lag}\nCONSUMER-ID ${ownerName}`}</ConfigLine>
        <Help>
          Lag is the log end offset minus the committed offset of group {GROUP}. The bar across the tape marks the committed offset: after a crash or rebalance, the next owner starts there.
        </Help>
      </Section>
    </div>
  );
}
