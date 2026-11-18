"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Stat, StatGrid } from "@/components/ui";
import { BROKERS, brokerLabel, list, PARTITION, secs, TOPIC, type Action, type State } from "../model";

/** The KRaft controller: partition leadership, ISR/ELR, broker sessions, and the operator's unclean election. */
export function ControllerPanel({ s, now, dispatch }: { s: State; now: number; dispatch: (a: Action) => void }) {
  const c = s.ctl;
  const canUnclean = c.leader === null && BROKERS.some((b) => !c.fenced[b]);
  return (
    <div>
      <InspectorHeader kind="KRaft controller" title="controller" status={<Pill tone={c.leader === null ? "err" : "ok"}>{c.leader === null ? `${PARTITION} offline` : `${PARTITION} online`}</Pill>} />
      <Section title="Partition">
        <StatGrid cols={3}>
          <Stat label="leader" value={c.leader === null ? "none" : brokerLabel(c.leader)} tone={c.leader === null ? "err" : undefined} />
          <Stat label="epoch" value={c.epoch} />
          <Stat label="ISR" value={list(c.isr)} tone={c.isr.length < Math.min(s.settings.minIsr, 3) ? "warn" : undefined} />
        </StatGrid>
        <StatGrid cols={3}>
          <Stat label="ELR" value={list(c.elr)} />
          <Stat label="min ISR" value={s.settings.minIsr} />
          <Stat label="unclean" value={s.settings.unclean === 1 ? "true" : "false"} />
        </StatGrid>
      </Section>
      <Section title="Broker sessions">
        <table className="mt-1 w-full font-mono text-note">
          <tbody>
            {BROKERS.map((b) => (
              <tr key={b} className={c.fenced[b] ? "text-err" : "text-fg"}>
                <td>{brokerLabel(b)}</td>
                <td className="text-right">{c.fenced[b] ? "fenced" : `heartbeat ${secs(Math.max(0, now - c.lastHb[b]))} ago`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Help>A broker with no heartbeat for broker.session.timeout.ms ({secs(s.settings.sessionMs)} here) is fenced: out of the ISR, and if it led, replaced.</Help>
      </Section>
      <Section title="Operate">
        <div className="flex flex-wrap gap-1.5">
          <Button tone="danger" disabled={!canUnclean} onClick={() => dispatch({ type: "unclean-election" })}>
            Force an unclean election
          </Button>
        </div>
        <Help>Runs only while the partition has no leader: picks any live replica, in sync or not. Acknowledged records it doesn&apos;t have are lost.</Help>
        <ConfigLine>{["kafka-leader-election.sh \\", "  --bootstrap-server … \\", "  --election-type unclean \\", `  --topic ${TOPIC} --partition 0`].join("\n")}</ConfigLine>
      </Section>
    </div>
  );
}
