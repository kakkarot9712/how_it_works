"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Stat, StatGrid } from "@/components/ui";
import type { Action, SessionId, State } from "../model";

/** The backend process serving a session: what pg_stat_activity says, and the admin functions that cancel or end it. */
export function BackendPanel({ s, id, now, dispatch }: { s: State; id: SessionId; now: number; dispatch: (a: Action) => void }) {
  const sess = s.sessions[id];
  const w = sess.wait;
  return (
    <div>
      <InspectorHeader
        kind={`backend · ${sess.label}`}
        title={sess.connected ? `pid ${sess.pid}` : "terminated"}
        status={<Pill tone={w ? "warn" : sess.backend === "idle" ? "muted" : "ok"}>{w ? "waiting" : sess.backend}</Pill>}
      />
      <Section title="Break it">
        <div className="flex flex-wrap gap-1.5">
          <Button tone="danger" disabled={!w} onClick={() => dispatch({ type: "cancel", s: id })}>
            pg_cancel_backend({sess.pid})
          </Button>
          <Button tone="danger" disabled={!sess.connected} onClick={() => dispatch({ type: "terminate", s: id })}>
            pg_terminate_backend({sess.pid})
          </Button>
        </div>
        <Help>
          Cancel stops the statement that is waiting; inside a transaction block that aborts the transaction. Terminate closes the
          connection and rolls back whatever it had open.
        </Help>
      </Section>
      <Section title="pg_stat_activity">
        <ConfigLine>{"SELECT pid, state, wait_event_type, wait_event FROM pg_stat_activity;"}</ConfigLine>
        <div className="mt-2">
          <StatGrid>
            <Stat label="state" value={sess.connected ? sess.backend : "—"} />
            <Stat label="wait_event" value={w ? "Lock: transactionid" : "—"} tone={w ? "warn" : undefined} />
            <Stat label="backend_xid" value={sess.tx?.xid ?? "—"} />
            <Stat label="waiting for" value={w ? `xid ${w.xid}, ${((now - w.since) / 1000).toFixed(1)}s` : "—"} tone={w ? "warn" : undefined} />
          </StatGrid>
        </div>
        <Help>
          PostgreSQL runs one server process per connection. A backend blocked on a row lock waits for the other transaction to end:
          wait_event_type Lock, wait_event transactionid.
        </Help>
      </Section>
    </div>
  );
}
