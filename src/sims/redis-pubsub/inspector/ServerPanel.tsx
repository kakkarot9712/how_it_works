"use client";

import { InspectorHeader } from "@/components/inspector";
import { Button, Glossed, Help, Pill, Section, Stat, StatGrid } from "@/components/ui";
import { derived, kb, type Action, type State } from "../model";

/** redis-server: crash/restart and server-wide stats. */
export function ServerPanel({ s, dispatch }: { s: State; dispatch: (a: Action) => void }) {
  const mem = derived(s).memBytes;
  return (
    <div>
      <InspectorHeader kind="server" title="redis-server" status={<Pill tone={s.server.up ? "ok" : "err"}>{s.server.up ? "up" : "down"}</Pill>} />
      <Section title="Break it">
        <div className="flex flex-wrap gap-1.5">
          <Button tone="danger" disabled={!s.server.up} onClick={() => dispatch({ type: "crash-server" })}>
            Crash redis-server
          </Button>
          <Button disabled={s.server.up} onClick={() => dispatch({ type: "restart-server" })}>
            Restart now
          </Button>
        </div>
        <Help>
          A supervisor (systemd, Kubernetes) restarts it after a few seconds. Subscriptions are not persisted.
        </Help>
      </Section>
      <Section title="Stats">
        <StatGrid>
          <Stat label="published" value={s.stats.published} />
          <Stat label="to 0 receivers" value={s.stats.noReceivers} tone={s.stats.noReceivers ? "warn" : undefined} />
          <Stat label="buffer memory" value={kb(mem)} />
          <Stat label="msgs dropped" value={s.stats.lost} tone={s.stats.lost ? "err" : undefined} />
        </StatGrid>
      </Section>
      <Section title="Under the hood">
        <Glossed>
          <ul className="list-disc space-y-1 pl-4 text-note leading-snug text-fg-muted">
          <li>One thread runs the event loop. PUBLISH walks the channel&apos;s subscriber list, then every pattern.</li>
          <li>A subscribed connection (RESP2) may only send SUBSCRIBE, UNSUBSCRIBE, PSUBSCRIBE, PUNSUBSCRIBE, PING, RESET and QUIT.</li>
          <li>Delivery is at-most-once: no acks, no retries, no storage.</li>
        </ul>
        </Glossed>
      </Section>
    </div>
  );
}
