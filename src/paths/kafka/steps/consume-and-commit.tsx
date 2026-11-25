import { Trace, type TraceSpec } from "@/components/path";
import {
  citer,
  Prose,
  simplifier,
  TryIt,
  WriteupSection,
} from "@/components/writeup";
import { pickSources } from "@/lib/sources";
import { pool } from "../sources";

export const sources = pickSources(pool, [
  "consumer-javadoc",
  "design",
  "intro",
  "consumer-configs",
  "protocol",
  "kip-848",
  "broker-configs",
]);
const cite = citer(sources);
const simplified = simplifier(sources);

const why = (
  <WriteupSection id="groups" title="Why a consumer group">
    <p>
      One consumer reading a whole topic has to fetch and process every record
      itself. A <strong>consumer group</strong> lets a pool of processes divide
      that work, on one machine or many, for scalability and for fault
      tolerance. Every consumer started with the same <code>group.id</code>{" "}
      joins the same group.{cite("consumer-javadoc")}
    </p>
    <p>
      Kafka delivers each record of the subscribed topics to <em>one</em>{" "}
      process in each group. It does that by splitting the partitions: each
      partition is assigned to exactly one consumer in the group, so a topic
      with four partitions read by a group of two processes gives each process
      two partitions.{cite("consumer-javadoc")} That is why records with the
      same key are handled by one consumer, in order: they share a partition,
      and the partition has one owner.
    </p>
    <p>
      The group also handles failure. If a process fails, its partitions are
      reassigned to the others in the same group; when a new consumer joins,
      partitions are moved to it. This is called <strong>rebalancing</strong>.
      {cite("consumer-javadoc")}
    </p>
    <p>
      A group behaves like one logical subscriber made of several processes, and
      a topic can have any number of groups without copying the data. Put all
      processes in one group and the records are shared out between them, like a
      queue. Give each process its own group and each one gets every record,
      like publish-subscribe.{cite("consumer-javadoc")} So a{" "}
      <code>billing</code> group and an <code>email</code> group can both read
      all of <code>orders</code>, each at its own pace.
    </p>
  </WriteupSection>
);

const many = (
  <WriteupSection id="many" title="One consumer, several partitions">
    <p>
      A consumer often owns more than one partition. It sends fetch requests to
      the brokers leading the partitions it wants, naming an offset in each.
      {cite("design")} Because each partition has one owner per group, the
      consumer&apos;s progress in a partition is a single number,
      {cite("design")} and it keeps one such number per partition it owns.
    </p>
    <p>
      One <code>poll()</code> can return records from several of its partitions.
      Kafka&apos;s own example walks the result partition by partition and
      commits each partition&apos;s offset separately.{cite("consumer-javadoc")}{" "}
      Order is guaranteed inside each partition,{cite("intro")} so the code can
      rely on the order of one key&apos;s records, not on how records from
      different partitions interleave.
    </p>
  </WriteupSection>
);

const intro = (
  <WriteupSection id="setup" title="Two numbers per partition">
    <p>
      For each partition it reads, a consumer tracks two numbers. Its{" "}
      <strong>position</strong> is the offset of the next record it will be
      given, and moves on by itself every time <code>poll()</code> returns
      records. The <strong>committed offset</strong> is the last one stored
      safely: the offset a replacement will start from if this consumer fails.
      {cite("consumer-javadoc")}
    </p>
    <p>
      The gap between them is where duplicates and losses come from. This trace
      follows consumer-1 on <code>orders-0</code>, which already holds records 0
      to 13, from a committed offset of 4, and then crashes it. Both consumers
      use the consumer rebalance protocol, <code>group.protocol=consumer</code>;
      the client default is still <code>classic</code>.
      {cite("consumer-configs")}
    </p>
  </WriteupSection>
);

export const trace: TraceSpec = {
  actors: [
    { id: "c1", label: "consumer-1" },
    { id: "leader", label: "broker-1", sub: "orders-0 leader" },
    { id: "coord", label: "broker-3", sub: "group coordinator" },
    { id: "c2", label: "consumer-2" },
  ],
  state: {
    fields: [
      {
        id: "pos",
        label: "Position: the next offset poll() returns",
        short: "position",
      },
      { id: "done", label: "Processed up to (offset)", short: "processed" },
      {
        id: "committed",
        label: "Committed offset for orders-0",
        short: "committed",
      },
    ],
    initial: {
      c1: { pos: "4", done: "3" },
      coord: { committed: "4" },
      c2: { pos: "–", done: "–" },
    },
  },
  hops: [
    {
      from: "c1",
      to: "leader",
      label: "Fetch(offset=4)",
      title:
        "poll() fetches from the partition's leader, starting at the position.",
      body: (
        <>
          The consumer pulls with fetch requests to the leaders of its
          partitions.{cite("design")} If there is nothing new, the broker holds
          the request in a long poll, up to <code>fetch.max.wait.ms</code> (500
          ms by default).{cite("design", "consumer-configs")}
        </>
      ),
    },
    {
      from: "leader",
      to: "c1",
      label: "records 4..8",
      reply: true,
      title: "Five records come back, and the position moves on by itself.",
      set: { c1: { pos: "9" } },
      body: (
        <>
          <code>poll()</code> hands them to your code, at most{" "}
          <code>max.poll.records</code> (500 by default) per call.
          {cite("consumer-configs")} The position advances as soon as they are
          returned, before your code has looked at them.
          {cite("consumer-javadoc")}
        </>
      ),
    },
    {
      from: "c1",
      to: "c1",
      label: "process 4..8",
      title: "Your code processes them. Kafka knows nothing about it.",
      set: { c1: { done: "8" } },
      body: (
        <>
          Processing is the application&apos;s business. As far as the group is
          concerned, offset 4 is still the last safe point.
        </>
      ),
    },
    {
      from: "c1",
      to: "coord",
      label: "OffsetCommit(9)",
      simplified: simplified(
        ["consumer-configs"],
        <>
          One partition and an explicit commit after each batch. With{" "}
          <code>enable.auto.commit</code> (on by default) commits run on a timer
          instead, <code>auto.commit.interval.ms</code>, so they can land
          anywhere in this loop.
        </>,
      ),
      title: "The consumer commits 9: the next record it will need.",
      body: (
        <>
          The committed offset should be the next message the application will
          consume, so 9, not 8.{cite("consumer-javadoc")} The{" "}
          <code>OffsetCommit</code> request goes to the group&apos;s coordinator
          and carries the group id, the member id and its epoch.
          {cite("protocol")} With <code>enable.auto.commit=true</code> (the
          default) the client sends it every{" "}
          <code>auto.commit.interval.ms</code>, 5000 ms by default.
          {cite("consumer-configs")}
        </>
      ),
    },
    {
      from: "coord",
      to: "coord",
      label: "append to __consumer_offsets",
      title: "The coordinator stores it as a record in an internal topic.",
      set: { coord: { committed: "9" } },
      body: (
        <>
          A consumer&apos;s position is stored as a message in an internal
          topic,{cite("design")} <code>__consumer_offsets</code>, whose
          partitions the group coordinator works from.{cite("kip-848")}{" "}
          Processing then committing is <strong>at-least-once</strong>: a crash
          between the two means processing some records again.{cite("design")}
        </>
      ),
    },
    {
      from: "c1",
      to: "leader",
      label: "Fetch(offset=9)",
      title: "The next poll() fetches from 9.",
      body: (
        <>
          The loop goes round again: fetch from the position, process, commit.
        </>
      ),
    },
    {
      from: "leader",
      to: "c1",
      label: "records 9..13",
      reply: true,
      title: "Five more records. The position moves to 14.",
      set: { c1: { pos: "14" } },
      body: (
        <>
          Committed is still 9: nothing has been processed from this batch yet.
        </>
      ),
    },
    {
      from: "c1",
      to: "c1",
      label: "process 9..11, then ✕",
      title: "consumer-1 processes three of them and is killed.",
      set: { c1: { done: "11", pos: "✕" } },
      body: (
        <>
          A <code>kill -9</code>: no final commit and no <code>LeaveGroup</code>
          . Records 9, 10 and 11 were processed, but the committed offset still
          says 9.
        </>
      ),
    },
    {
      from: "coord",
      to: "coord",
      label: "session timeout",
      simplified: simplified(
        ["kip-848"],
        <>
          Heartbeats and the rest of the rebalance (revoking partitions,
          acknowledging) are left out here. The consumer groups lab shows them.
        </>,
      ),
      title:
        "The coordinator waits out the session timeout, then removes consumer-1.",
      body: (
        <>
          A consumer that crashes or can&apos;t send heartbeats for the session
          timeout is considered dead, and its partitions are reassigned.
          {cite("consumer-javadoc")} On the consumer protocol that timeout is
          the broker&apos;s <code>group.consumer.session.timeout.ms</code>, 45 s
          by default.{cite("broker-configs")} Until then <code>orders-0</code>{" "}
          has an owner that isn&apos;t reading it.
        </>
      ),
    },
    {
      from: "coord",
      to: "c2",
      label: "assign orders-0",
      simplified: simplified(
        ["kip-848"],
        <>
          Which broker is a group&apos;s coordinator depends on the group;
          broker-3 here is only an example.
        </>,
      ),
      reply: true,
      title: "consumer-2 is given orders-0 in its heartbeat response.",
      body: (
        <>
          On the consumer protocol the coordinator computes the new assignment
          and hands it to each member in its <code>ConsumerGroupHeartbeat</code>{" "}
          response.{cite("kip-848")}
        </>
      ),
    },
    {
      from: "c2",
      to: "coord",
      label: "OffsetFetch",
      title: "consumer-2 asks where the group got to on orders-0.",
      body: (
        <>
          It reads the group&apos;s committed offset for the partition with an{" "}
          <code>OffsetFetch</code> request.{cite("protocol")}
        </>
      ),
    },
    {
      from: "coord",
      to: "c2",
      label: "committed=9",
      reply: true,
      title: "The answer is 9, not 12.",
      set: { c2: { pos: "9" } },
      body: (
        <>
          The committed offset is the one a consumer recovers to after a
          failure.{cite("consumer-javadoc")} The coordinator has no idea that
          consumer-1 got as far as 11.
        </>
      ),
    },
    {
      from: "c2",
      to: "leader",
      label: "Fetch(offset=9)",
      title: "consumer-2 fetches from 9.",
      body: <>Same leader, same records: 9 to 13 come back.</>,
    },
    {
      from: "c2",
      to: "c2",
      label: "process 9..13",
      title: "Records 9, 10 and 11 are processed a second time.",
      set: { c2: { pos: "14", done: "13" } },
      body: (
        <>
          These are the duplicates at-least-once delivery allows for.
          {cite("design")} Making the processing idempotent, for example writes
          keyed on a primary key, makes them harmless.{cite("design")}
        </>
      ),
    },
  ],
};

const after = (
  <>
    <WriteupSection id="takeaways" title="What to take away">
      <ul>
        <li>
          <strong>
            Kafka tracks a position per partition, not an acknowledgement per
            record.
          </strong>{" "}
          The consumer&apos;s position is a single integer: the offset of the
          next message to consume.{cite("design")}
        </li>
        <li>
          <strong>
            The order of process and commit decides the failure mode.
          </strong>{" "}
          Commit after processing: duplicates after a crash (at-least-once).
          Commit before processing: records skipped after a crash
          (at-most-once).{cite("design")}
        </li>
        <li>
          <strong>A crash costs a session timeout of silence first.</strong>{" "}
          Nobody reads the dead consumer&apos;s partitions until the coordinator
          gives up on it.{cite("consumer-javadoc")}
        </li>
      </ul>
      <TryIt
        simHref="/kafka/consumer-groups"
        items={[
          {
            id: "crash-duplicates",
            n: 3,
            title: "A consumer crashes: at-least-once",
          },
          {
            id: "at-most-once",
            n: 4,
            title: "Commit before processing: at-most-once",
          },
        ]}
      />
    </WriteupSection>

    <WriteupSection id="what-if" title="What if a partition is added?">
      <p>
        <strong>The group rebalances to give it an owner.</strong> Rebalancing
        is also used when partitions are added to a subscribed topic: the group
        detects them through periodic metadata refreshes and assigns them to its
        members.{cite("consumer-javadoc")} How fast depends on the protocol.
        With the classic protocol, a new partition is found on a metadata
        refresh (<code>metadata.max.age.ms</code>, 5 minutes by default) and a
        rebalance that follows; with the consumer protocol (KIP-848), the
        coordinator pushes the new assignment on the next group heartbeat (
        <code>group.consumer.heartbeat.interval.ms</code>, 5 seconds by default
        on the server).{cite("consumer-configs")}
      </p>
      <p>
        <strong>The records written during that gap can be skipped.</strong> The
        new partition has no committed offset for the group, so{" "}
        <code>auto.offset.reset</code> picks the start, and its default is{" "}
        <code>latest</code>. Producers may already be appending to the new
        partition before the group finds it, and <code>latest</code> starts at
        the log end, which the Kafka docs call silent message loss. They
        recommend <code>by_duration</code>, sized to cover the discovery gap.
        {cite("consumer-configs")}
      </p>
      <p>
        <strong>And keyed records change partition.</strong> The producer side
        of the same change is in the first step: keys move to new partitions, so
        for a while two consumers can hold records of the same key.
      </p>
    </WriteupSection>
  </>
);

/** Trace: one consumer's fetch, process and commit loop, a crash, and the replay that follows. */
export function Body() {
  return (
    <Prose>
      {why}
      {many}
      {intro}
      <Trace spec={trace} title="orders-0 · commit after processing" />
      {after}
    </Prose>
  );
}
