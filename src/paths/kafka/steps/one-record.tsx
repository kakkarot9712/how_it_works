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
  "design",
  "producer-configs",
  "protocol",
  "partition-scala",
  "broker-configs",
  "consumer-javadoc",
  "topic-configs",
]);
const cite = citer(sources);
const simplified = simplifier(sources);

// Sections are JSX constants in reading order, so the file's citation order is the page's.
const intro = (
  <WriteupSection id="setup" title="One record, one partition">
    <p>
      Each partition has a single leader and zero or more followers, and all
      writes go to the leader.{cite("design")} Here <code>orders-0</code> has
      three replicas: broker-1 leads, broker-2 and broker-3 follow. The producer
      uses the default, <code>acks=all</code>: it wants an acknowledgement only
      when the full set of in-sync replicas has the record.
      {cite("producer-configs")}
    </p>
    <p>
      Step through it with the arrows (or ← and →). Each box at the top shows
      that actor&apos;s state; the values a hop changes light up.
    </p>
  </WriteupSection>
);

export const trace: TraceSpec = {
  actors: [
    { id: "producer", label: "producer", sub: "acks=all" },
    { id: "b1", label: "broker-1", sub: "leader" },
    { id: "b2", label: "broker-2", sub: "follower" },
    { id: "b3", label: "broker-3", sub: "follower" },
    { id: "consumer", label: "consumer" },
  ],
  state: {
    fields: [
      { id: "leo", label: "Log end offset (LEO)", short: "LEO" },
      {
        id: "seen",
        label: "This replica\u2019s LEO, as the leader knows it",
        short: "leader sees",
      },
      { id: "hw", label: "High watermark (HW)", short: "HW" },
      { id: "pos", label: "Consumer position", short: "position" },
    ],
    initial: {
      b1: { leo: "0", seen: "0", hw: "0" },
      b2: { leo: "0", seen: "0", hw: "0" },
      b3: { leo: "0", seen: "0", hw: "0" },
      consumer: { pos: "0" },
    },
  },
  hops: [
    {
      from: "producer",
      to: "b1",
      label: "Produce(acks=-1)",
      simplified: simplified(
        ["producer-configs"],
        <>
          One record. Real producers batch records per partition, bounded by{" "}
          <code>batch.size</code> and <code>linger.ms</code>, and send a batch
          in one request.
        </>,
      ),
      title: "The producer sends the record straight to the leader.",
      body: (
        <>
          There is no routing tier: the producer sends data directly to the
          broker that leads the partition.{cite("design")} On the wire,{" "}
          <code>acks=all</code> is <code>-1</code>, &ldquo;the full ISR&rdquo;.
          {cite("protocol")}
        </>
      ),
    },
    {
      from: "b1",
      to: "b1",
      label: "append @0",
      title: "The leader appends it at offset 0. It is written, not committed.",
      set: { b1: { leo: "1", seen: "1" } },
      body: (
        <>
          broker-1&apos;s log end offset is now 1. The high watermark stays at
          0, because a write is not committed until all in-sync replicas have
          received it.{cite("design")} The request waits on the leader: an{" "}
          <code>acks=-1</code> write completes only once the high watermark has
          passed its offset.{cite("partition-scala")}
        </>
      ),
    },
    {
      from: "b1",
      to: "b2",
      label: "records @0",
      simplified: simplified(
        ["broker-configs"],
        <>
          Both followers&apos; fetches are already waiting at the leader when
          the record arrives, and both answers go out at once. In a real cluster
          each follower&apos;s fetch arrives on its own schedule.
        </>,
      ),
      reply: true,
      title: "broker-2's waiting fetch is answered with the record.",
      body: (
        <>
          Followers pull from the leader just as a consumer would.
          {cite("design")} broker-2 already had a fetch for offset 0 waiting at
          the leader: with no data, the leader holds a follower&apos;s fetch for
          up to <code>replica.fetch.wait.max.ms</code> (500 ms by default), and
          answers as soon as there is data.{cite("broker-configs")} The response
          also carries the leader&apos;s <code>high_watermark</code>, still 0.
          {cite("protocol")}
        </>
      ),
    },
    {
      from: "b1",
      to: "b3",
      label: "records @0",
      reply: true,
      title: "broker-3's waiting fetch gets it too.",
      body: (
        <>
          The same for broker-3. The leader never pushes: each follower&apos;s
          own fetch decides when it gets data.{cite("design")}
        </>
      ),
    },
    {
      from: "b2",
      to: "b2",
      label: "append @0",
      title: "broker-2 writes the record to its own log.",
      set: { b2: { leo: "1" } },
      body: (
        <>
          Followers apply what they fetch to their own log.{cite("design")}{" "}
          broker-2 has the record, but the leader doesn&apos;t know that yet.
        </>
      ),
    },
    {
      from: "b3",
      to: "b3",
      label: "append @0",
      title: "broker-3 writes it too.",
      set: { b3: { leo: "1" } },
      body: (
        <>
          Both followers now hold offset 0. In the leader&apos;s books (
          <em>leader sees</em>) they are both still at 0.
        </>
      ),
    },
    {
      from: "b2",
      to: "b1",
      label: "Fetch(offset=1)",
      title: "broker-2's next fetch tells the leader it has offset 0.",
      set: { b2: { seen: "1" } },
      body: (
        <>
          The fetch asks for the next offset broker-2 needs,{" "}
          <code>fetch_offset</code> 1.{cite("protocol")} The leader records that
          as broker-2&apos;s log end offset and tries to move the high
          watermark, which is the smallest log end offset among the in-sync
          replicas.{cite("partition-scala")} broker-3 still counts as 0, so it
          stays at 0.
        </>
      ),
    },
    {
      from: "b3",
      to: "b1",
      label: "Fetch(offset=1)",
      title:
        "broker-3's fetch completes the set: the high watermark moves to 1.",
      set: { b3: { seen: "1" }, b1: { hw: "1" } },
      body: (
        <>
          Every in-sync replica has offset 0 now, so the leader advances its
          high watermark to 1: offset 0 is committed.{cite("partition-scala")}
        </>
      ),
    },
    {
      from: "b1",
      to: "producer",
      label: "base_offset=0",
      reply: true,
      title: "The waiting Produce request completes.",
      body: (
        <>
          The high watermark has passed the record, so the leader answers. The
          response carries the record&apos;s offset, <code>base_offset</code> 0.
          {cite("protocol")} Two follower round trips after the append, the
          producer knows every in-sync replica has it.
        </>
      ),
    },
    {
      from: "b1",
      to: "b2",
      label: "high_watermark=1",
      reply: true,
      title:
        "Followers learn the new high watermark from a later fetch response.",
      set: { b2: { hw: "1" } },
      body: (
        <>
          Every fetch response carries the leader&apos;s{" "}
          <code>high_watermark</code>,{cite("protocol")} so a follower&apos;s
          high watermark trails the leader&apos;s a little.
        </>
      ),
    },
    {
      from: "b1",
      to: "b3",
      label: "high_watermark=1",
      reply: true,
      title: "broker-3 catches up on the high watermark too.",
      set: { b3: { hw: "1" } },
      body: <>All three replicas now agree that offset 0 is committed.</>,
    },
    {
      from: "consumer",
      to: "b1",
      label: "Fetch(offset=0)",
      simplified: simplified(
        ["design"],
        <>
          The consumer only asks after the record is committed. A consumer that
          had fetched earlier would simply have waited at the leader for it.
        </>,
      ),
      title: "A consumer fetches from the leader.",
      body: (
        <>
          Consumers also pull, with fetch requests to the brokers leading the
          partitions they read.{cite("design")} The offset it asks for is its
          position: the offset of the next record it will be given.
          {cite("consumer-javadoc")}
        </>
      ),
    },
    {
      from: "b1",
      to: "consumer",
      label: "records @0",
      reply: true,
      title: "It gets the record, because it is committed.",
      set: { consumer: { pos: "1" } },
      body: (
        <>
          Only committed records are ever given out to consumers,
          {cite("design")} so a record below the high watermark is safe to hand
          over. The consumer&apos;s position advances to 1 as{" "}
          <code>poll()</code> returns it.{cite("consumer-javadoc")}
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
          <strong>Replication is pull.</strong> The leader learns that a
          follower has a record only from that follower&apos;s next fetch, so an{" "}
          <code>acks=all</code> write waits for a round trip to every in-sync
          follower after the append.{cite("partition-scala")}
        </li>
        <li>
          <strong>The high watermark separates written from committed.</strong>{" "}
          It is the smallest log end offset in the ISR; producers with{" "}
          <code>acks=all</code> and consumers both wait for it.
          {cite("partition-scala", "design")}
        </li>
        <li>
          <strong>
            <code>acks=1</code> skips the wait.
          </strong>{" "}
          The leader answers right after its own append, and if it fails before
          the followers have replicated the record, the record is lost.
          {cite("producer-configs")} The next step makes that happen.
        </li>
      </ul>
      <TryIt
        simHref="/kafka/produce-and-replicate"
        items={[
          { id: "happy", n: 1, title: "Healthy: produce, fetch, commit" },
        ]}
      />
    </WriteupSection>

    <WriteupSection id="what-if" title="What if…">
      <p>
        <strong>
          …broker-3 stops fetching? Does this <code>acks=all</code> write wait
          forever?
        </strong>{" "}
        No. The leader drops a follower from the ISR when it hasn&apos;t
        fetched, or hasn&apos;t caught up to the leader&apos;s log end, for{" "}
        <code>replica.lag.time.max.ms</code>: 30 000 ms by default.
        {cite("broker-configs")} From then on the high watermark is the smallest
        log end offset of broker-1 and broker-2 alone, so in this trace the
        record would be committed, and the producer answered, about 30 seconds
        late instead of never.{cite("partition-scala")}
      </p>
      <p>
        <strong>…both followers drop out and only the leader is left?</strong>{" "}
        That depends on <code>min.insync.replicas</code>. At its default of 1,
        the leader alone is enough and <code>acks=all</code> writes go on, now
        kept on a single broker. Set it to 2 and the leader rejects them
        instead, with <code>NOT_ENOUGH_REPLICAS</code>, rather than acknowledge
        a record that only one broker has.{cite("topic-configs", "protocol")}
        The replication lab makes both happen.
      </p>
    </WriteupSection>
  </>
);

/** Trace: one record from producer to consumer through a three-replica partition. */
export function Body() {
  return (
    <Prose>
      {intro}
      <Trace spec={trace} title="orders-0 · replication factor 3 · acks=all" />
      {after}
    </Prose>
  );
}
