import { AnnotatedConfig, Callout, Compare, Figure, Prose, TryIt, WriteupSection } from "@/components/writeup";
import type { WriteupMeta } from "@/sims/explainers";
import { scenarios } from "../scenarios";
import { StreamDiagram } from "./StreamDiagram";

export const meta: WriteupMeta = {
  title: "How Redis Streams consumer groups actually work",
  lede: "An append-only log stored as a key, read through consumer groups that track what each consumer was given and hasn't acknowledged. Nothing is lost when a consumer dies, but nothing is redelivered unless you claim it.",
  facts: [
    { label: "Delivery", value: "at-least-once" },
    { label: "Storage", value: "a key (RDB/AOF)" },
    { label: "Model", value: "pull, can BLOCK" },
    { label: "Recovery", value: "PEL + XAUTOCLAIM" },
  ],
  sections: [
    { id: "path", title: "The path of one entry" },
    { id: "groups", title: "Groups, consumers and lag" },
    { id: "pel", title: "The PEL and XACK" },
    { id: "claim", title: "Taking over stuck entries" },
    { id: "poison", title: "Poison entries" },
    { id: "trimming", title: "Trimming ignores groups" },
    { id: "restart", title: "Restarts and persistence" },
    { id: "alternatives", title: "When to use something else" },
    { id: "simplifies", title: "What this simulation simplifies" },
  ],
};

/** Scenario links by id, numbered as in the simulator's picker. */
function see(...ids: string[]) {
  return ids.map((id) => {
    const i = scenarios.findIndex((s) => s.id === id);
    if (i < 0) throw new Error(`Explainer links to unknown scenario "${id}"`);
    return { id, n: i + 1, title: scenarios[i].title };
  });
}

/** Long-form write-up for /redis/streams/how-it-works (server component). */
export function Explainer({ simHref }: { simHref: string }) {
  return (
    <Prose>
      <WriteupSection id="path" title="The path of one entry">
        <p>
          A stream is a Redis key holding an append-only sequence of entries, each a small set of field-value pairs with an
          ID. A consumer group is state stored <em>inside</em> that key: a position in the stream (
          <code>last-delivered-id</code>) and a pending entries list (PEL) of what was handed out but not yet acknowledged.
          Consumers are just names within a group.
        </p>
        <Figure
          caption={
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                <code className="font-mono text-fg">XADD orders * order 10</code> appends an entry. Redis generates the ID
                (<code className="font-mono text-fg">&lt;milliseconds&gt;-&lt;sequence&gt;</code>) and replies with it.
              </li>
              <li>
                The XADD wakes consumers blocked in <code className="font-mono text-fg">XREADGROUP … BLOCK</code>. Each group
                hands out entries after its own <code className="font-mono text-fg">last-delivered-id</code>, moves it forward,
                and records each entry in its PEL with the consumer&apos;s name, the delivery time and a delivery count.
              </li>
              <li>The consumer processes the entry. Redis doesn&apos;t know or care how long that takes.</li>
              <li>
                <code className="font-mono text-fg">XACK orders mailers &lt;id&gt;</code> removes the entry from the group&apos;s
                PEL. Until then, Redis treats it as possibly unprocessed.
              </li>
            </ol>
          }
        >
          <StreamDiagram />
        </Figure>
        <p>
          The entry itself stays in the stream after every group has acknowledged it. Acknowledging only changes the
          group&apos;s bookkeeping; deleting entries is a separate concern (trimming, below).
        </p>
        <TryIt simHref={simHref} items={see("happy")} />
      </WriteupSection>

      <WriteupSection id="groups" title="Groups, consumers and lag">
        <p>
          Consumers in the <em>same</em> group share the work: each entry goes to one of them. Different groups are
          independent: each gets every entry, at its own pace. Here <code>mailers</code> has two consumers that take turns,
          and <code>analytics</code> has one that sees all orders.
        </p>
        <AnnotatedConfig
          parts={[
            { token: "XREADGROUP", label: "command" },
            { token: "GROUP mailers mailer-1", label: "group, consumer", tone: "accent" },
            { token: "COUNT 4", label: "max per reply" },
            { token: "BLOCK 5000", label: "wait ≤ 5s" },
            { token: "STREAMS orders", label: "key" },
            { token: ">", label: "new only", tone: "warn" },
          ]}
        />
        <p>
          Delivery is <em>pull</em>: a consumer only ever receives what it asked for, COUNT entries at a time. A slow consumer
          doesn&apos;t grow a buffer inside Redis the way a Pub/Sub subscriber does; the entries simply wait in the stream and
          the group&apos;s <strong>lag</strong> grows. <code>XINFO GROUPS</code> reports it (Redis 7.0+) as the number of
          entries added to the stream that the group hasn&apos;t been given yet.
        </p>
        <p>
          A consumer that goes away for a while loses nothing. When it comes back, <code>&gt;</code> continues from the
          group&apos;s <code>last-delivered-id</code>, and it works through the backlog.
        </p>
        <TryIt simHref={simHref} items={see("happy", "catch-up")} />
      </WriteupSection>

      <WriteupSection id="pel" title="The PEL and XACK: at-least-once">
        <p>
          The PEL is what turns a log into a work queue. Each entry in it has an owner, the time it was last delivered (from
          which <code>XPENDING</code> computes idle time) and how many times it was delivered. A consumer that crashes before{" "}
          <code>XACK</code> leaves its entries there, owned by it.
        </p>
        <p>
          On restart, the usual pattern is to first read with ID <code>0</code> instead of <code>&gt;</code>:{" "}
          <code>XREADGROUP … STREAMS orders 0</code> returns this consumer&apos;s own pending entries, and adds 1 to their
          delivery count. When that comes back empty, switch to <code>&gt;</code>.
        </p>
        <p>
          Reading with <code>NOACK</code> skips the PEL entirely: an entry counts as acknowledged the moment it is delivered.
          That is at-most-once delivery. It saves a round trip and memory per entry, and a crash drops whatever the consumer
          was holding.
        </p>
        <TryIt simHref={simHref} items={see("noack")} />
      </WriteupSection>

      <WriteupSection id="claim" title="Taking over stuck entries">
        <p>
          Redis never redelivers on its own. If a consumer is gone for good (scaled down, its host lost), its pending entries
          wait forever. Another consumer has to take them over:
        </p>
        <AnnotatedConfig
          parts={[
            { token: "XAUTOCLAIM", label: "command (6.2+)" },
            { token: "orders mailers", label: "key + group" },
            { token: "mailer-2", label: "new owner", tone: "accent" },
            { token: "6000", label: "min-idle-time (ms)", tone: "warn" },
            { token: "0-0", label: "scan cursor" },
            { token: "COUNT 10", label: "max to claim" },
          ]}
        />
        <p>
          It scans the group&apos;s PEL for entries idle at least min-idle-time, makes the caller their owner, resets their
          idle time and increments their delivery count. It replies with a cursor for the next call, the claimed entries, and
          (since 7.0) the IDs of pending entries whose data no longer exists, which it removes from the PEL. Because claiming
          resets idle time, two consumers can&apos;t both claim the same entry at the same moment. Redis 8.4 adds a{" "}
          <code>CLAIM min-idle-time</code> option to <code>XREADGROUP</code> that does the same as part of a normal read.
        </p>
        <Callout tone="warn" title="Idle is not dead">
          <p>
            Redis only sees time passing. A consumer stuck in a long call or a GC pause looks exactly like a dead one. Its
            entries get claimed and processed by someone else, and when it wakes up it processes them again; its{" "}
            <code>XACK</code> then returns <code>0</code>. Consumer groups are at-least-once: make handlers idempotent, and set
            min-idle-time well above your slowest normal processing time.
          </p>
        </Callout>
        <TryIt simHref={simHref} items={see("dead-consumer", "hung")} />
      </WriteupSection>

      <WriteupSection id="poison" title="Poison entries and the delivery count">
        <p>
          Keeping an entry pending after a crash is exactly right for transient failures, and exactly wrong for an entry that
          will <em>always</em> crash its consumer. The consumer restarts, re-reads its pending entries, gets the same one, and
          crashes again. With XAUTOCLAIM in play, it can take down the other consumers one by one.
        </p>
        <p>
          The delivery count is the way out. Redis has no dead-letter queue built in, so consumers check the count (from{" "}
          <code>XPENDING orders mailers - + 10</code>, or in the reply of <code>XREADGROUP … CLAIM</code> on 8.4+) and, past a
          limit, copy the entry to another stream (<code>XADD orders:dead …</code>) and <code>XACK</code> the original.
        </p>
        <TryIt simHref={simHref} items={see("poison")} />
      </WriteupSection>

      <WriteupSection id="trimming" title="Trimming ignores consumer groups">
        <p>
          Streams don&apos;t expire entries on their own. You cap them, usually on every write:{" "}
          <code>XADD orders MAXLEN ~ 10000 * …</code> (or <code>MINID</code> to drop entries older than an ID). With{" "}
          <code>~</code>, Redis only removes whole internal nodes (up to <code>stream-node-max-entries</code>, default 100), so
          the stream can be slightly longer than the threshold, which is much cheaper.
        </p>
        <p>
          Trimming doesn&apos;t look at consumer groups. An entry a lagging group never read is deleted like any other, and
          nothing reports an error. Afterwards, <code>XINFO GROUPS</code> shows that group&apos;s lag as nil until it catches
          up to the end of the stream. A trimmed entry that was still <em>pending</em> keeps its ID in the PEL: reading it
          returns the ID with nil fields.
        </p>
        <Callout tone="warn" title="A slow group can silently lose data">
          <p>
            Size MAXLEN for the longest outage any group must survive, alert on lag, or on Redis 8.2+ trim with{" "}
            <code>XADD orders ACKED MAXLEN …</code>: <code>ACKED</code> only removes entries that every group has read and
            acknowledged (<code>KEEPREF</code>, the default, removes them regardless; <code>DELREF</code> also drops them from
            every PEL). Without any cap, the stream grows until memory runs out.
          </p>
        </Callout>
        <TryIt simHref={simHref} items={see("trim")} />
      </WriteupSection>

      <WriteupSection id="restart" title="Restarts and persistence">
        <p>
          A stream is a key, so it is saved in RDB snapshots and the AOF like any other, and so are its consumer groups:
          Redis writes the group changes caused by <code>XREADGROUP</code> and <code>XACK</code> to the AOF and to replicas.
          After a restart with <code>appendonly yes</code>, each group resumes at its <code>last-delivered-id</code> with its
          PEL intact. Compare Pub/Sub, where every subscription is gone.
        </p>
        <p>
          What doesn&apos;t survive is anything in flight. An <code>XADD</code> sent while Redis is down fails with{" "}
          <code>ECONNREFUSED</code>; the producer has to retry. An <code>XACK</code> that didn&apos;t reach Redis leaves the
          entry pending, so the consumer processes it again after reconnecting.
        </p>
        <TryIt simHref={simHref} items={see("restart")} />
      </WriteupSection>

      <WriteupSection id="alternatives" title="When to use something else">
        <p>
          Streams fit work queues and event fan-out at moderate volume when you already run Redis: retries, ownership and a
          replayable history, with sub-millisecond latency. The trade-off is memory: the whole stream lives in RAM.
        </p>
        <Compare
          head={["", "Redis Pub/Sub", "Redis Streams", "Kafka"]}
          rows={[
            ["Stores messages", "No", "Yes, as a key in RAM (RDB/AOF on disk)", "Yes, a replicated log on disk"],
            ["Delivery", "Push", "Pull: XREADGROUP, can BLOCK", "Pull: consumers fetch"],
            ["Guarantee", "At-most-once", "At-least-once with XACK (at-most-once with NOACK)", "At-least-once by default"],
            ["Work sharing", "None: every subscriber gets everything", "Per entry, within a group", "Per partition, within a group"],
            ["Consumer offline", "Misses everything", "Resumes from the group's last-delivered-id", "Resumes from its committed offset"],
            ["Dead consumer's work", "Lost", "Pending until claimed (XAUTOCLAIM)", "Partition reassigned on rebalance"],
            ["Slow consumer", "Grows its output buffer in Redis until closed", "Lag grows (until trimmed)", "Lag grows (until retention deletes data)"],
          ]}
        />
        <ul>
          <li>
            Losing messages is fine (cache invalidation, live dashboards)? <strong>Pub/Sub</strong> is simpler and keeps
            nothing in memory.
          </li>
          <li>
            Need long retention, high throughput, or a history larger than RAM? A disk-based log like{" "}
            <strong>Kafka</strong>. Note it hands out whole partitions, so ordering is per partition and one slow entry holds
            up its partition; Streams hand out individual entries.
          </li>
        </ul>
      </WriteupSection>

      <WriteupSection id="simplifies" title="What this simulation simplifies">
        <Callout title="Model vs reality">
          <ul>
            <li>
              Time is slowed down about a thousand times, and stream sizes are scaled down to match (MAXLEN 40 instead of
              thousands). Entry IDs use the simulation clock in milliseconds, not Unix time, so they are short.
            </li>
            <li>Trimming is exact (<code>=</code>), not node-at-a-time (<code>~</code>).</li>
            <li>
              Each consumer processes one entry at a time and sends one <code>XACK</code> per entry. Real clients often
              acknowledge several IDs in one call. The XAUTOCLAIM loop runs every 3 s on its own connection, with{" "}
              <code>COUNT 10</code>.
            </li>
            <li>
              The dead-letter check reads the delivery count Redis tracks; real code gets it from <code>XPENDING</code> or{" "}
              <code>XREADGROUP … CLAIM</code>.
            </li>
            <li>
              The restart reloads everything. With <code>appendfsync everysec</code> (the default), up to about a second of
              writes before a crash can be lost.
            </li>
            <li>
              A consumer that goes offline closes its connection at once. A lost host would leave a half-open connection until
              TCP keepalive notices; the PEL behaves the same either way.
            </li>
          </ul>
        </Callout>
      </WriteupSection>
    </Prose>
  );
}
