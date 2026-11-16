"use client";

import { InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Slider, Stat, StatGrid, Toggle } from "@/components/ui";
import { kb, type Action, type State } from "../model";
import { subStatus } from "../theme";

/** A subscriber: ways to break it (stall, cut, slow down, kill, take offline) and its counters. */
export function SubscriberPanel({ s, id, dispatch }: { s: State; id: string; dispatch: (a: Action) => void }) {
  const sub = s.subscribers[id];
  const st = subStatus(sub);
  return (
    <div>
      <InspectorHeader kind="subscriber" title={sub.label} status={<Pill tone={st.tone}>{st.text}</Pill>} />
      <Section title="Break it">
        <Toggle
          tone="danger"
          label="Stop reading the socket"
          help="The app is stuck: GC pause, deadlock, a slow handler."
          checked={sub.blocked}
          onChange={(on) => dispatch({ type: "set-blocked", sub: id, on })}
        />
        <Toggle
          tone="danger"
          label="Cut the network link"
          help="Packets vanish. Neither side is told."
          checked={!sub.linkUp}
          onChange={(v) => dispatch({ type: "set-link", sub: id, up: !v })}
        />
        <Slider
          label="Time to handle one message"
          value={sub.processMs}
          min={50}
          max={2000}
          step={50}
          unit="ms"
          help="Slower than the incoming rate means the backlog grows."
          onChange={(ms) => dispatch({ type: "set-process-ms", sub: id, ms })}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button tone="danger" disabled={!sub.registered || !s.server.up} onClick={() => dispatch({ type: "client-kill", sub: id })}>
            CLIENT KILL
          </Button>
          {sub.client === "offline" ? (
            <Button tone="primary" onClick={() => dispatch({ type: "go-online", sub: id })}>
              Bring online
            </Button>
          ) : (
            <Button onClick={() => dispatch({ type: "go-offline", sub: id })}>Take offline</Button>
          )}
        </div>
      </Section>
      <Section title="Stats">
        <StatGrid cols={3}>
          <Stat label="received" value={sub.received} />
          <Stat label="missed" value={sub.missed} tone={sub.missed ? "warn" : undefined} />
          <Stat label="lost" value={sub.lost} tone={sub.lost ? "err" : undefined} />
          <Stat label="disconnects" value={sub.disconnects} tone={sub.disconnects ? "warn" : undefined} />
          <Stat label="unread" value={sub.rx.length} />
          <Stat label="buffer" value={kb(sub.obufBytes)} />
        </StatGrid>
        <Help>
          <b className="text-fg">missed</b>: published while not subscribed. <b className="text-fg">lost</b>: sat in
          Redis&apos;s output buffer when the connection was closed. Neither can be recovered.
        </Help>
      </Section>
    </div>
  );
}
