"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Button, Glossed, Help, Pill, Section, Stat, StatGrid } from "@/components/ui";
import { DEAD_KEY, lastId, STREAM_KEY, type Action, type State } from "../model";

/** The stream key and redis-server: crash/restart, trimming config and stream-wide stats. */
export function StreamPanel({ s, dispatch }: { s: State; dispatch: (a: Action) => void }) {
  const st = s.stream;
  return (
    <div>
      <InspectorHeader kind="stream · redis-server" title={STREAM_KEY} status={<Pill tone={s.server.up ? "ok" : "err"}>{s.server.up ? "up" : "down"}</Pill>} />
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
          Runs with <code>appendonly yes</code>, so the stream and its groups are reloaded on restart.
        </Help>
      </Section>
      <Section title="Trimming">
        <ConfigLine>{s.components.maxlen ? `XADD ${STREAM_KEY} MAXLEN ${s.settings.maxLen} * …` : `XADD ${STREAM_KEY} * …`}</ConfigLine>
        <Help className="mt-1.5">
          {s.components.maxlen
            ? "Exact trimming (=). Production code usually writes MAXLEN ~ 10000, which trims whole internal nodes and is cheaper. Either way trimming ignores consumer groups."
            : "No trimming: the stream keeps every entry until memory runs out (or maxmemory evicts the whole key)."}
        </Help>
      </Section>
      <Section title="Stats">
        <StatGrid>
          <Stat label="XLEN" value={st.entries.length} />
          <Stat label="entries-added" value={st.entriesAdded} />
          <Stat label="trimmed" value={st.trimmed} tone={st.trimmed ? "warn" : undefined} />
          <Stat label="last-generated-id" value={lastId(s)} />
          {s.components.deadLetter && s.components.ack && <Stat label={DEAD_KEY} value={s.deadLetter.length} tone={s.deadLetter.length ? "err" : undefined} />}
        </StatGrid>
      </Section>
      <Section title="Under the hood">
        <Glossed>
          <ul className="list-disc space-y-1 pl-4 text-note leading-snug text-fg-muted">
            <li>A stream is a radix tree of listpack nodes, keyed by entry ID. Appending and trimming the oldest entries are cheap.</li>
            <li>Consumer groups and their PELs live inside the stream key, so they are saved in RDB and AOF and replicated.</li>
            <li>Consumers pull with XREADGROUP. A slow consumer only grows its group&apos;s lag, not a buffer in Redis.</li>
          </ul>
        </Glossed>
      </Section>
    </div>
  );
}
