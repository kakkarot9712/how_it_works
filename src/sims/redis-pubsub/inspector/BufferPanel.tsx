"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Button, Glossed, Help, Section, Stat, StatGrid } from "@/components/ui";
import { kb, type State } from "../model";

/** A client output buffer: what it is, the live limit config, and its current size. */
export function BufferPanel({ s, id, now, select }: { s: State; id: string; now: number; select: (id: string) => void }) {
  const sub = s.subscribers[id];
  const cfg = s.components.limits
    ? `client-output-buffer-limit pubsub ${s.settings.hardKb}kb ${s.settings.softKb}kb ${s.settings.softSeconds}`
    : "client-output-buffer-limit pubsub 0 0 0";
  return (
    <div>
      <InspectorHeader kind="client output buffer" title={sub.label} />
      <Section title="What this is">
        <Glossed>
          <p className="text-sm leading-relaxed text-fg-muted">
          Memory inside Redis holding replies that could not be written to the socket yet. Redis never blocks on a slow
          client. It keeps the data here, so a slow reader costs Redis RAM.
        </p>
        </Glossed>
        <ConfigLine>{cfg}</ConfigLine>
        <Help className="mt-1.5">
          Default is <code>32mb 8mb 60</code>. The values here are scaled down to fit slow motion.
          {!s.components.limits && " 0 0 0 means no limit at all."}
        </Help>
      </Section>
      <Section title="Live">
        <StatGrid>
          <Stat label="size" value={kb(sub.obufBytes)} />
          <Stat label="messages" value={sub.obuf.length} />
          <Stat label="peak" value={kb(sub.peakBytes)} />
          <Stat
            label="over soft for"
            value={sub.softSince !== null ? `${((now - sub.softSince) / 1000).toFixed(1)}s` : "—"}
            tone={sub.softSince !== null ? "warn" : undefined}
          />
          <Stat label="in TCP window" value={`${sub.inflight} / ${s.settings.window}`} />
          <Stat label="dropped so far" value={sub.lost} tone={sub.lost ? "err" : undefined} />
        </StatGrid>
        <Button className="mt-2" onClick={() => select(id)}>
          Control {sub.label} →
        </Button>
      </Section>
    </div>
  );
}
