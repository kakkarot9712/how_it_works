import { AnnotatedConfig, Callout, citer, Compare, Figure, Prose, ServerOutput, TryIt, WriteupSection } from "@/components/writeup";
import type { WriteupMeta } from "@/sims/explainers";
import { scenarios } from "../scenarios";
import { sources } from "../sources";
import { ConsumerPathDiagram } from "./ConsumerPathDiagram";
import { TopicDiagram } from "./TopicDiagram";

export const meta: WriteupMeta = {
  title: "How Kafka consumer groups actually work",
  lede: "A group splits a topic's partitions among its consumers, one owner per partition. Each consumer pulls, processes and then commits an offset; what you commit, and when, decides whether a crash means duplicates or loss.",
  facts: [
    { label: "Delivery", value: "pull (long poll)" },
    { label: "Order", value: "per partition" },
    { label: "Progress", value: "committed offset" },
    { label: "Default commits", value: "auto, every 5 s" },
  ],
  sections: [
    { id: "partitions", title: "What a partition is" },
    { id: "path", title: "The path of one record" },
    { id: "keys", title: "Keys, partitions and order" },
    { id: "groups", title: "One partition, one consumer" },
    { id: "commits", title: "Offsets and delivery guarantees" },
    { id: "rebalance", title: "Rebalances: classic vs consumer protocol" },
    { id: "liveness", title: "Heartbeats and the poll timer" },
    { id: "poison", title: "Poison records" },
    { id: "simplifies", title: "What this simulation simplifies" },
  ],
};

function see(...ids: string[]) {
  return ids.map((id) => {
    const i = scenarios.findIndex((s) => s.id === id);
    if (i < 0) throw new Error(`unknown scenario "${id}"`);
    return { id, n: i + 1, title: scenarios[i].title };
  });
}

const cite = citer(sources);

export function Explainer({ simHref }: { simHref: string }) {
  return (
    <Prose>
      <WriteupSection id="partitions" title="What a partition is">
        <p>
          Kafka stores <em>records</em> (also called events or messages): a key, a value, a timestamp and optional headers. Records are organized into <em>topics</em>, named
          streams like <code>payments</code> or, here, <code>orders</code>. Reading a record doesn&apos;t delete it; a topic keeps records for as long as its retention
          setting says.{cite("intro")}
        </p>
        <p>
          A topic is not one log but several. It is split into <em>partitions</em>, &ldquo;buckets&rdquo; placed on different brokers, so clients can write to and read
          from many brokers at the same time. Every new record is appended to exactly one of the topic&apos;s partitions.{cite("intro")} On disk, each partition is its own
          directory of log files: a topic <code>my-topic</code> with two partitions is the directories <code>my-topic-0</code> and <code>my-topic-1</code>.{cite("log-impl")}
        </p>
        <p>
          Inside a partition, records sit in the order they were appended, and each gets an <em>offset</em>: a number that identifies it within that partition. A consumer
          at position 5 has read offsets 0 to 4 and reads 5 next.{cite("consumer-javadoc")} Offsets are per partition: <code>orders-0</code> offset 7 and{" "}
          <code>orders-1</code> offset 7 are unrelated records. There is no order across partitions, only within one: Kafka&apos;s design calls a topic &ldquo;a set of
          totally ordered partitions&rdquo;.{cite("design")}
        </p>
        <Figure
          caption={
            <ol className="list-decimal space-y-1 pl-5">
              <li>Topic <code>orders</code> is three independent logs: <code>orders-0</code>, <code>orders-1</code>, <code>orders-2</code>.</li>
              <li>Each log only grows at its end, and numbers its records 0, 1, 2… on its own.</li>
              <li>The producer decides which log a record joins (next section: by key).</li>
              <li>The broker names are illustrative: the simulator draws the partitions but not the brokers holding them.</li>
            </ol>
          }
        >
          <TopicDiagram />
        </Figure>
        <p>
          Almost everything else in Kafka is per partition. It is the unit of replication: one leader broker takes all writes for it, and followers copy it.{cite("design")}{" "}
          It is also the unit of parallelism for consumers: in a group, each partition is read by exactly one consumer at a time, so a consumer&apos;s whole progress in a
          partition is one number, the offset of the next record.{cite("design")} That is why the rest of this page keeps coming back to partitions: they decide ordering,
          how much a group can parallelize, and what an offset commit means.
        </p>
        <p>
          In the simulator, each of the three middle cards is one partition of <code>orders</code>. The row of cells is the tail of its log, one cell per record, labelled
          with its key, numbered by offset from left to right.
        </p>
        <TryIt simHref={simHref} items={see("happy")} />
      </WriteupSection>

      <WriteupSection id="path" title="The path of one record">
        <p>
          Which partition does a record join? The producer decides. When the record has a key and no explicit partition, the
          producer&apos;s built-in partitioner hashes the serialized key with murmur2 and takes it modulo the partition count: <code>toPositive(murmur2(key)) % numPartitions</code>.
          {cite("partitioner-java", "producer-configs")}
        </p>
        <p>
          Consumers pull. A consumer sends fetch requests to the brokers leading its partitions, naming the offset it wants, and gets back a chunk of log from there. If
          there is nothing new, the request can wait at the broker (a long poll) until data arrives.{cite("design")} The consumer&apos;s position in a partition is a single
          number: the offset of the next record it will read.{cite("design", "consumer-javadoc")}
        </p>
        <p>
          The <em>committed</em> offset is a second number, stored by Kafka for the group: the position a consumer recovers to after a restart or a rebalance. It should be
          the offset of the next record the application will process.{cite("consumer-javadoc")} <code>kafka-consumer-groups.sh --describe</code> shows it as{" "}
          <code>CURRENT-OFFSET</code>, next to <code>LOG-END-OFFSET</code> and their difference, <code>LAG</code>.{cite("ops")}
        </p>
        <Figure
          caption={
            <ol className="list-decimal space-y-1 pl-5">
              <li>The producer hashes each key to a partition: u2 and u4 always go to orders-0.</li>
              <li>Each partition has one owner in the group. consumer-1 reads orders-0 and orders-1.</li>
              <li>The consumer&apos;s position (teal) runs ahead of the committed offset (the bar) until it commits.</li>
              <li>Lag is the log end offset minus the committed offset.</li>
            </ol>
          }
        >
          <ConsumerPathDiagram />
        </Figure>
        <TryIt simHref={simHref} items={see("happy")} />
      </WriteupSection>

      <WriteupSection id="keys" title="Keys, partitions and order">
        <p>
          Events with the same key are written to the same partition, and any consumer of a partition reads its events in exactly the order they were written.
          {cite("intro")} That is the ordering guarantee: per partition, which with keys means per key. There is none across partitions.
        </p>
        <p>
          Records without a key go to a sticky partition that changes once <code>batch.size</code> bytes have been sent to it. Setting <code>partitioner.ignore.keys=true</code>{" "}
          makes the producer treat keyed records the same way.{cite("producer-configs")} Do that and one key&apos;s records land in several partitions, which different
          consumers process in parallel: in the simulator, the <strong>Partition by key</strong> block.
        </p>
        <p>
          The flip side of keying is skew. Every record with a hot key goes to one partition, and only one consumer in a group reads that partition,{cite("consumer-javadoc")} so
          that partition&apos;s throughput is one consumer&apos;s throughput, however many you add.
        </p>
        <TryIt simHref={simHref} items={see("happy", "hot-key")} />
      </WriteupSection>

      <WriteupSection id="groups" title="One partition, one consumer">
        <p>
          Consumers that share a <code>group.id</code> form a group. Kafka balances the partitions so that each one is assigned to exactly one consumer in the group: a topic
          with four partitions and a group of two processes gives each process two.{cite("consumer-javadoc")} If a process fails, its partitions are reassigned; if one joins,
          partitions move to it. That is a rebalance.{cite("consumer-javadoc")}
        </p>
        <p>
          With more consumers than partitions, some get nothing. The operations guide&apos;s own <code>--describe --members</code> example shows a member with{" "}
          <code>#PARTITIONS</code> 0.{cite("ops")}
        </p>
        <TryIt simHref={simHref} items={see("scale-out")} />
      </WriteupSection>

      <WriteupSection id="commits" title="Offsets and delivery guarantees">
        <p>
          Kafka&apos;s design document describes the two orders a consumer can choose. Save the position, then process: a crash in between skips records, which is{" "}
          <em>at-most-once</em>. Process, then save the position: a crash in between repeats records, which is <em>at-least-once</em>, and is harmless if updates are idempotent.
          {cite("design")}
        </p>
        <AnnotatedConfig
          parts={[
            { token: "enable.auto.commit=true", label: "the default" },
            { token: "auto.commit.interval.ms=5000", label: "commit every 5 s" },
            { token: "max.poll.records=500", label: "records per poll()" },
          ]}
        />
        <p>
          Defaults: <code>enable.auto.commit=true</code> with <code>auto.commit.interval.ms=5000</code>.{cite("consumer-configs")} With auto commit, records count as consumed
          once <code>poll()</code> has returned them. It still gives at-least-once if you finish every record from one <code>poll()</code> before the next call; if you
          don&apos;t, the committed offset can get ahead of what you processed and records go missing. To control it yourself, turn auto commit off and call{" "}
          <code>commitSync()</code> after processing.{cite("consumer-javadoc")}
        </p>
        <Callout tone="warn" title="Auto commit's window is your duplicate window">
          A consumer that dies just before its next auto commit leaves up to <code>auto.commit.interval.ms</code> of processed work uncommitted. Whoever takes over starts from
          the committed offset and does it all again.
        </Callout>
        <TryIt simHref={simHref} items={see("crash-duplicates", "at-most-once")} />
      </WriteupSection>

      <WriteupSection id="rebalance" title="Rebalances: classic vs consumer protocol">
        <p>
          Kafka 4.x has two group protocols. The consumer&apos;s <code>group.protocol</code> defaults to <code>classic</code>; setting it to <code>consumer</code> enables the
          protocol from KIP-848, generally available since 4.0, and enabled by default on the broker since 4.0.{cite("consumer-configs", "rebalance-protocol")} Kafka 5.0 is
          planned to make it the client default.{cite("rebalance-protocol")}
        </p>
        <p>
          <strong>Classic.</strong> Members rejoin with <code>JoinGroup</code>, a leader member computes the assignment, and everyone collects its share with{" "}
          <code>SyncGroup</code>. In eager mode a consumer revokes <em>all</em> its partitions before rejoining.{cite("kip-848")} The default{" "}
          <code>partition.assignment.strategy</code> is <code>[RangeAssignor, CooperativeStickyAssignor]</code>, which uses the eager <code>RangeAssignor</code>.
          {cite("consumer-configs")} Members learn a rebalance has started from a heartbeat answered with <code>REBALANCE_IN_PROGRESS</code>.{cite("protocol")}
        </p>
        <p>
          <strong>Consumer protocol.</strong> There is no global synchronization barrier.{cite("rebalance-protocol")} The coordinator bumps a group epoch when membership
          changes, computes a target assignment with a server-side assignor (<code>uniform</code> by default, or <code>range</code>), and reconciles each member over its{" "}
          <code>ConsumerGroupHeartbeat</code>: first it revokes partitions the member must give up, waits for the member to acknowledge, and only then assigns those
          partitions to their new owner. Assignors are sticky, to minimise movement.{cite("kip-848", "broker-configs")} The group shows as <code>Assigning</code> and{" "}
          <code>Reconciling</code> until every member reaches the target, then <code>Stable</code>; classic groups go through <code>PreparingRebalance</code> and{" "}
          <code>CompletingRebalance</code>.{cite("group-states")}
        </p>
        <Compare
          head={["", "classic (eager, RangeAssignor)", "consumer (KIP-848)"]}
          rows={[
            ["Who computes the assignment", "a leader member", "the coordinator"],
            ["During a rebalance", "every member revokes everything", "only moving partitions pause"],
            ["Heartbeat and session settings", "client: heartbeat.interval.ms, session.timeout.ms", "broker: group.consumer.*"],
            ["Default heartbeat", "3 s", "5 s"],
          ]}
        />
        <p>
          The session timeout defaults to 45 s in both: <code>session.timeout.ms</code> on the client for classic, <code>group.consumer.session.timeout.ms</code> on the broker
          for the consumer protocol.{cite("consumer-configs", "broker-configs")}
        </p>
        <TryIt simHref={simHref} items={see("scale-out", "stop-the-world")} />
      </WriteupSection>

      <WriteupSection id="liveness" title="Heartbeats and the poll timer">
        <p>
          Two separate checks decide whether a consumer is alive. Heartbeats, sent in the background: if a consumer crashes or can&apos;t heartbeat for the session timeout,
          it is considered dead and its partitions are reassigned. And the poll timer: a consumer that keeps heartbeating but doesn&apos;t call <code>poll()</code> within{" "}
          <code>max.poll.interval.ms</code> leaves the group itself, so another consumer can take its partitions. Its next commit can then fail with{" "}
          <code>CommitFailedException</code>.{cite("consumer-javadoc")}
        </p>
        <p>
          <code>max.poll.interval.ms</code> defaults to 5 minutes and <code>max.poll.records</code> to 500.{cite("consumer-configs")} When the timer runs out, the client logs:
        </p>
        <ServerOutput>
          Consumer poll timeout has expired. This means the time between subsequent calls to poll() was longer than the configured max.poll.interval.ms, which typically implies
          that the poll loop is spending too much time processing messages. You can address this either by increasing max.poll.interval.ms or by reducing the maximum size of
          batches returned in poll() with max.poll.records.
        </ServerOutput>
        <p>
          (The classic client starts the same line with a lower-case &ldquo;consumer&rdquo;.){cite("heartbeat-java")} A batch that takes longer than the interval to process
          gets its consumer pushed out on every cycle, and each push is a rebalance.
        </p>
        <TryIt simHref={simHref} items={see("crash-duplicates", "slow-consumer")} />
      </WriteupSection>

      <WriteupSection id="poison" title="Poison records">
        <p>
          Kafka stores bytes; it doesn&apos;t know a record will make your handler throw. A plain consumer has no built-in policy for that: if the code retries the record
          forever, the partition stops at that offset, because records in a partition are processed in order.{cite("intro")} The consumer still heartbeats, so only the
          poll timer removes it, and the partition, poison included, moves to the next consumer.{cite("consumer-javadoc")}
        </p>
        <p>
          Kafka Connect ships the usual way out: <code>errors.tolerance=all</code> skips problematic records, and <code>errors.deadletterqueue.topic.name</code> names a
          topic where a sink connector writes the records that failed.{cite("connect-configs")} The simulator&apos;s <strong>Dead-letter handling</strong> block is the same
          idea in application code.
        </p>
        <TryIt simHref={simHref} items={see("poison")} />
      </WriteupSection>

      <WriteupSection id="simplifies" title="What this simulation simplifies">
        <Callout title="Model vs reality">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Slow motion: a network hop is 0.15 s and a record takes 0.25 s to process. Timeouts are scaled down (session timeout 4.5 s, <code>max.poll.interval.ms</code> 6 s,
              heartbeats every 1 s) and <code>max.poll.records</code> is 5.
            </li>
            <li>One topic, three partitions, no replication. The partitions and the coordinator stand for brokers; there is no broker failure here.</li>
            <li>Each partition gets its own fetch request (a real consumer sends one fetch per broker for all its partitions on it). A fetch waits at most 0.5 s.</li>
            <li>
              The application processes one record at a time on the poll thread. Revocation is handled at the next <code>poll()</code>, as rebalance callbacks are.
            </li>
            <li>
              The group starts with committed offset 0 on every partition. <code>auto.offset.reset</code>, <code>group.initial.rebalance.delay.ms</code> and the
              assignment fetch of committed offsets (<code>OffsetFetch</code>) are left out.
            </li>
            <li>
              Classic: JoinGroup and SyncGroup are folded into one round trip, and the coordinator computes the RangeAssignor result itself. Consumer protocol: the{" "}
              <code>uniform</code> assignor is approximated as &ldquo;balanced, keep what you can&rdquo;. A restarted consumer reuses its member slot.
            </li>
            <li>
              Without keys, the sticky partitioner switches partition every 4 records instead of every <code>batch.size</code> bytes.
            </li>
            <li>Poison handling and the dead-letter topic are application behaviour, modelled as a handler that throws on one record.</li>
          </ul>
        </Callout>
      </WriteupSection>
    </Prose>
  );
}
