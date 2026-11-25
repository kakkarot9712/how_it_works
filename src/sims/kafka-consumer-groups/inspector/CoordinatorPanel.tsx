"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Help, Pill, Section, Stat, StatGrid } from "@/components/ui";
import { CONSUMERS, consId, GROUP, type State } from "../model";
import { groupStateTone } from "../theme";

export function CoordinatorPanel({ s, now }: { s: State; now: number }) {
  const g = s.coord;
  const classic = !s.components.incremental;
  const members = CONSUMERS.filter((c) => g.members[c]);
  return (
    <div>
      <InspectorHeader kind="broker" title="group coordinator" status={<Pill tone={groupStateTone(s)}>{g.state}</Pill>} />
      <Section title="Stats">
        <StatGrid cols={3}>
          <Stat label="members" value={members.length} />
          <Stat label={classic ? "generation" : "group epoch"} value={g.groupEpoch} />
          <Stat label="rebalances" value={g.rebalances} />
        </StatGrid>
      </Section>
      <Section title="Members">
        <ul className="space-y-1 text-sm">
          {members.map((c) => (
            <li key={c} className="flex justify-between font-mono">
              <span>{consId(c)}</span>
              <span className="text-fg-muted">{((now - g.members[c].lastHb) / 1000).toFixed(1)} s since heartbeat</span>
            </li>
          ))}
          {!members.length && <li className="text-fg-muted">No members.</li>}
        </ul>
      </Section>
      <Section title="Config">
        <ConfigLine>
          {classic
            ? `group.protocol=classic\npartition.assignment.strategy=\n  RangeAssignor (eager)\nsession.timeout.ms=${s.settings.sessionMs}`
            : `group.protocol=consumer\ngroup.consumer.assignors=uniform\ngroup.consumer.session.timeout.ms=\n  ${s.settings.sessionMs}`}
        </ConfigLine>
        <Help>
          A broker that manages group {GROUP}: it tracks members by their heartbeats, decides who owns which partition, and stores committed offsets in the internal __consumer_offsets topic.
        </Help>
      </Section>
    </div>
  );
}
