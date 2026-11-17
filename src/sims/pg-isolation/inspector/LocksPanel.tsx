"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Button, Glossed, Help, Section, Stat, StatGrid } from "@/components/ui";
import { ROWS, SESSIONS, type Action, type State } from "../model";

/** The lock table: row locks, waits (with a cancel button each) and, at Serializable, SIRead locks. */
export function LocksPanel({ s, now, dispatch }: { s: State; now: number; dispatch: (a: Action) => void }) {
  const waiting = SESSIONS.map((id) => s.sessions[id]).filter((x) => x.wait);
  return (
    <div>
      <InspectorHeader kind="shared memory" title="locks" />
      <Section title="Break it">
        {waiting.length === 0 && <Help>Nobody is waiting right now.</Help>}
        <div className="flex flex-wrap gap-1.5">
          {waiting.map((w) => (
            <Button key={w.id} tone="danger" onClick={() => dispatch({ type: "cancel", s: w.id })}>
              Cancel {w.label}&apos;s wait
            </Button>
          ))}
        </div>
      </Section>
      <Section title="Now">
        <ul className="space-y-1 font-mono text-note text-fg">
          {ROWS.filter((r) => s.rowLocks[r]).map((r) => (
            <li key={r}>
              {r}: xid {s.rowLocks[r]!.xid} {s.rowLocks[r]!.mode}
            </li>
          ))}
          {waiting.map((w) => (
            <li key={w.id} className="text-warn">
              pid {w.pid} waits for ShareLock on transaction {w.wait!.xid} ({((now - w.wait!.since) / 1000).toFixed(1)}s)
            </li>
          ))}
          {s.ssi.map((t) => (
            <li key={t.key}>
              SIReadLock · Session {t.session} · {t.reads.includes("*") ? "relation" : t.reads.join(", ") || "nothing yet"}
            </li>
          ))}
        </ul>
        <ConfigLine>{`deadlock_timeout = ${s.settings.deadlockTimeoutMs}ms`}</ConfigLine>
      </Section>
      <Section title="Stats">
        <StatGrid>
          <Stat label="deadlocks" value={s.deadlocks} tone={s.deadlocks ? "err" : undefined} />
          <Stat label="serialization failures" value={s.serializationFailures} tone={s.serializationFailures ? "err" : undefined} />
        </StatGrid>
      </Section>
      <Section title="Under the hood">
        <Glossed>
          <ul className="list-disc space-y-1 pl-4 text-note leading-snug text-fg-muted">
            <li>Row locks block only writers and lockers of the same row. A plain SELECT never waits for one.</li>
            <li>An UPDATE takes FOR NO KEY UPDATE on the row; SELECT … FOR UPDATE takes FOR UPDATE. The two conflict.</li>
            <li>A waiter checks for a deadlock only after deadlock_timeout, because the check is expensive.</li>
            <li>SIRead locks (Serializable, SSI) never block anyone. They only record who read what, to detect rw-conflicts.</li>
          </ul>
        </Glossed>
      </Section>
    </div>
  );
}
