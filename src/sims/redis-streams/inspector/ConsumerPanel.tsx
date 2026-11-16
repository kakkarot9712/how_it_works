"use client";

import { InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Slider, Stat, StatGrid, Toggle } from "@/components/ui";
import { pendingOf, type Action, type State } from "../model";
import { consumerStatus } from "../theme";

/** A consumer: ways to break it (hang, kill, take offline, slow down), XAUTOCLAIM by hand, and its counters. */
export function ConsumerPanel({ s, id, dispatch }: { s: State; id: string; dispatch: (a: Action) => void }) {
  const c = s.consumers[id];
  const g = s.groups[c.group];
  const st = consumerStatus(c);
  const alive = c.status === "running" || c.status === "reconnecting";
  return (
    <div>
      <InspectorHeader kind={`consumer · group ${g.name}`} title={c.label} status={<Pill tone={st.tone}>{st.text}</Pill>} />
      <Section title="Break it">
        <Toggle
          tone="danger"
          label="Hang"
          help="Stuck in a call or a long GC pause. Keeps its connection and its pending entries."
          checked={c.hung}
          onChange={(on) => dispatch({ type: "set-hung", consumer: id, on })}
        />
        <Slider
          label="Time to process one entry"
          value={c.processMs}
          min={50}
          max={3000}
          step={50}
          unit="ms"
          help="Slower than the incoming rate means the group's lag grows."
          onChange={(ms) => dispatch({ type: "set-process-ms", consumer: id, ms })}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button tone="danger" disabled={!alive} onClick={() => dispatch({ type: "crash-consumer", consumer: id })}>
            Kill (restarts)
          </Button>
          {c.status === "offline" ? (
            <Button tone="primary" onClick={() => dispatch({ type: "start-consumer", consumer: id })}>
              Bring online
            </Button>
          ) : (
            <Button onClick={() => dispatch({ type: "stop-consumer", consumer: id })}>Take offline</Button>
          )}
        </div>
      </Section>
      <Section title="Recover">
        <Button disabled={c.status !== "running" || !s.server.up || !s.components.ack} onClick={() => dispatch({ type: "claim-now", consumer: id })}>
          XAUTOCLAIM now
        </Button>
        <Help>
          Takes over entries in the {g.name} PEL idle for at least {s.settings.minIdleMs / 1000}s, from any consumer
          {s.components.claim ? ". It also runs on its own every 3s." : ". The automatic loop is removed."}
        </Help>
      </Section>
      <Section title="Stats">
        <StatGrid cols={3}>
          <Stat label="processed" value={c.done} />
          <Stat label="duplicates" value={c.dups} tone={c.dups ? "warn" : undefined} />
          <Stat label="crashes" value={c.crashes} tone={c.crashes ? "err" : undefined} />
          <Stat label="pending" value={pendingOf(g, id)} />
          <Stat label="in batch" value={c.queue.length + (c.processing ? 1 : 0)} />
          <Stat label="last" value={c.recent.length ? `#${c.recent[0]}` : "—"} />
        </StatGrid>
        <Help>
          <b className="text-fg">pending</b>: delivered to this consumer and not yet XACKed, as Redis sees it.{" "}
          <b className="text-fg">duplicates</b>: entries it processed that had already been processed in this group.
        </Help>
      </Section>
    </div>
  );
}
