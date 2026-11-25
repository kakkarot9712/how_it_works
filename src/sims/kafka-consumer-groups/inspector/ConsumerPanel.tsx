"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Slider, Stat, StatGrid } from "@/components/ui";
import { COMMIT_MODES, consId, partId, type Action, type State } from "../model";
import { consumerStatus } from "../theme";

const COMMIT_CONFIG = ["enable.auto.commit=true\nauto.commit.interval.ms=", "enable.auto.commit=false\n# commitSync() after processing", "enable.auto.commit=false\n# commitSync() before processing"];

export function ConsumerPanel({ s, c, now, dispatch }: { s: State; c: number; now: number; dispatch: (a: Action) => void }) {
  const k = s.consumers[c];
  const st = consumerStatus(s, c);
  const mode = s.settings.commitMode;
  return (
    <div>
      <InspectorHeader kind="consumer" title={consId(c)} status={<Pill tone={st.tone}>{st.text}</Pill>} />
      <Section title="Break it">
        <div className="flex flex-wrap gap-1.5">
          {k.up ? (
            <>
              <Button tone="danger" onClick={() => dispatch({ type: "crash", c })}>
                Crash (kill -9)
              </Button>
              <Button onClick={() => dispatch({ type: "shutdown", c })}>Shut down cleanly</Button>
            </>
          ) : (
            <Button tone="primary" onClick={() => dispatch({ type: "start", c })}>
              {k.crashed ? "Restart" : "Start"} {consId(c)}
            </Button>
          )}
        </div>
        <Slider
          label="Slow processing"
          value={k.slow}
          min={1}
          max={8}
          step={1}
          unit="×"
          help="Each record takes this many times longer. Past max.poll.interval.ms per batch, the consumer is pushed out of the group."
          onChange={(v) => dispatch({ type: "slow", c, factor: v })}
        />
      </Section>
      <Section title="Stats">
        <StatGrid cols={3}>
          <Stat label="owns" value={k.up && k.owned.length ? k.owned.map((p) => `p${p}`).join(" ") : "-"} />
          <Stat label="processed" value={k.processedCount} />
          <Stat label="twice" value={k.dupCount} tone={k.dupCount ? "warn" : undefined} />
          <Stat label="since poll" value={k.up ? `${((now - k.lastPollAt) / 1000).toFixed(1)} s` : "-"} tone={k.up && now - k.lastPollAt > s.settings.maxPollIntervalMs * 0.7 ? "err" : undefined} />
          <Stat label="batch" value={k.buffer.length + (k.processing ? 1 : 0)} />
          <Stat label="parked" value={k.dlqCount} />
        </StatGrid>
        {k.up && k.owned.length > 0 && (
          <p className="mt-2 font-mono text-note text-fg-muted">
            position {k.owned.map((p) => `${partId(p)}@${k.position[p]}`).join(", ")}
          </p>
        )}
      </Section>
      <Section title="Config">
        <ConfigLine>{`${COMMIT_CONFIG[mode]}${mode === 0 ? s.settings.autoCommitMs : ""}\nmax.poll.records=${s.settings.maxPollRecords}\nmax.poll.interval.ms=${s.settings.maxPollIntervalMs}`}</ConfigLine>
        <Help>
          A process in the group. Its poll loop fetches a batch, processes it one record at a time, and commits ({COMMIT_MODES[mode]}). Heartbeats go to the coordinator in the background.
        </Help>
      </Section>
    </div>
  );
}
