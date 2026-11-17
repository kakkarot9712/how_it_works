"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Help, Section, Stat, StatGrid } from "@/components/ui";
import type { State } from "../model";

/** pg_xact: every transaction ID's commit status. */
export function XactPanel({ s }: { s: State }) {
  const xids = Object.keys(s.xact)
    .map(Number)
    .sort((a, b) => b - a);
  const last = xids[0];
  return (
    <div>
      <InspectorHeader kind="commit status" title="pg_xact" />
      <Section title="Transaction status">
        <ConfigLine>{`SELECT pg_xact_status('${last}');`}</ConfigLine>
        <ul className="mt-2 space-y-0.5 font-mono text-note">
          {xids.map((x) => (
            <li key={x} className="flex justify-between">
              <span className="text-fg">{x}</span>
              <span className="text-fg-muted">{s.xact[x]}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Stats">
        <StatGrid>
          <Stat label="next xid" value={s.nextXid} />
          <Stat label="latest completed" value={s.latestCompleted} />
        </StatGrid>
        <Help>
          Committing doesn&apos;t touch the table: the xid&apos;s status changes here, and every row version it wrote becomes visible to
          snapshots taken afterwards. Rolling back flips it to aborted, and its versions become invisible.
        </Help>
      </Section>
    </div>
  );
}
