"use client";

import { InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Slider, Stat, StatGrid, Toggle } from "@/components/ui";
import { CHANNELS, type Action, type State } from "../model";
import { CHANNEL_COLOR } from "../theme";

/** A publisher: publish by hand, traffic controls, and its replies. */
export function PublisherPanel({ s, id, dispatch }: { s: State; id: string; dispatch: (a: Action) => void }) {
  const p = s.publishers[id];
  return (
    <div>
      <InspectorHeader kind="publisher" title={p.label} status={<Pill tone={p.auto ? "ok" : "muted"}>{p.auto ? "publishing" : "paused"}</Pill>} />
      <Section title="Publish by hand">
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((ch) => (
            <Button key={ch} onClick={() => dispatch({ type: "publish", pub: id, channel: ch })}>
              <span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_COLOR[ch] }} />
              PUBLISH {ch}
            </Button>
          ))}
        </div>
        <Help>
          Nobody subscribes to <code className="text-fg">refunds</code>. Try it and watch the reply.
        </Help>
      </Section>
      <Section title="Traffic">
        <Toggle label={`Auto-publish to ${p.channel}`} checked={p.auto} onChange={(on) => dispatch({ type: "set-auto", pub: id, on })} />
        <Slider
          label="Interval"
          value={p.intervalMs}
          min={150}
          max={2000}
          step={50}
          unit="ms"
          onChange={(ms) => dispatch({ type: "set-interval", pub: id, ms })}
        />
        <Slider
          label="Payload size"
          value={p.payloadBytes}
          min={128}
          max={4096}
          step={128}
          unit=" B"
          help="Bigger messages fill output buffers faster."
          onChange={(bytes) => dispatch({ type: "set-payload", pub: id, bytes })}
        />
      </Section>
      <Section title="Stats">
        <StatGrid>
          <Stat label="sent" value={p.sent} />
          <Stat
            label="last reply"
            value={p.lastReply?.text ?? "—"}
            tone={p.lastReply?.error ? "err" : p.lastReply?.text === "(integer) 0" ? "warn" : undefined}
          />
        </StatGrid>
        <Help>
          PUBLISH replies with the number of clients that received the message. It is the only feedback a publisher
          gets. There is no acknowledgement from subscribers.
        </Help>
      </Section>
    </div>
  );
}
