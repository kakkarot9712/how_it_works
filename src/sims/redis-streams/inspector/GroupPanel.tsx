"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Button, Glossed, Help, Section, Stat, StatGrid } from "@/components/ui";
import { lag, pendingOf, STREAM_KEY, type State } from "../model";
import { groupLagText } from "../theme";

/** A consumer group: what XINFO GROUPS and XPENDING would say about it. */
export function GroupPanel({ s, id, now, select }: { s: State; id: string; now: number; select: (id: string) => void }) {
  const g = s.groups[id];
  const l = lag(s, g);
  const oldest = g.pel.reduce((m, p) => Math.max(m, now - p.deliveredAt), 0);
  return (
    <div>
      <InspectorHeader kind="consumer group" title={g.name} />
      <Section title="What this is">
        <Glossed>
          <p className="text-sm leading-relaxed text-fg-muted">
            A cursor into the stream (last-delivered-id) plus a PEL: every entry handed to a consumer and not yet
            acknowledged, with its owner, delivery time and delivery count.
          </p>
        </Glossed>
        <ConfigLine>{`XGROUP CREATE ${STREAM_KEY} ${g.name} $${g.id === "mailers" ? " MKSTREAM" : ""}`}</ConfigLine>
      </Section>
      <Section title="XINFO GROUPS">
        <StatGrid>
          <Stat label="last-delivered-id" value={g.lastId} />
          <Stat label="entries-read" value={g.lastN} />
          <Stat label="lag" value={groupLagText(l)} tone={l === null ? "err" : l > 5 ? "warn" : undefined} />
          <Stat label="pending" value={g.pel.length} tone={g.pel.length > 6 ? "warn" : undefined} />
        </StatGrid>
        {l === null && (
          <Help>Lag is nil: unread entries were deleted, so Redis can&apos;t count what&apos;s left. It comes back once the group reads the newest entry.</Help>
        )}
      </Section>
      <Section title="XPENDING">
        <StatGrid>
          <Stat label="oldest idle" value={`${(oldest / 1000).toFixed(1)}s`} tone={oldest >= s.settings.minIdleMs ? "err" : undefined} />
          <Stat label="min-idle-time" value={`${s.settings.minIdleMs / 1000}s`} />
          {g.consumers.map((cid) => (
            <Stat key={cid} label={s.consumers[cid].label} value={`${pendingOf(g, cid)} pending`} />
          ))}
        </StatGrid>
      </Section>
      <Section title="Stats">
        <StatGrid cols={3}>
          <Stat label="delivered" value={g.delivered} />
          <Stat label="acked" value={g.acked} />
          <Stat label="claimed" value={g.claimed} tone={g.claimed ? "warn" : undefined} />
          <Stat label="duplicates" value={g.duplicates} tone={g.duplicates ? "warn" : undefined} />
          <Stat label="trimmed unread" value={g.trimmedUnread} tone={g.trimmedUnread ? "err" : undefined} />
          <Stat label="lost (NOACK)" value={g.lostNoAck} tone={g.lostNoAck ? "err" : undefined} />
        </StatGrid>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {g.consumers.map((cid) => (
            <Button key={cid} onClick={() => select(cid)}>
              Control {s.consumers[cid].label} →
            </Button>
          ))}
        </div>
      </Section>
    </div>
  );
}
