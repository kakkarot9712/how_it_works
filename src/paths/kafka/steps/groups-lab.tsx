import { Predict, type Prediction } from "@/components/path";
import { Callout, citer, Prose, WriteupSection } from "@/components/writeup";
import { pickSources } from "@/lib/sources";
import { pool } from "../sources";

export const sources = pickSources(pool, ["consumer-javadoc", "consumer-configs", "design", "ops", "intro", "partitioner-java"]);
const cite = citer(sources);
export const simHref = "/kafka/consumer-groups";

const intro = (
  <WriteupSection id="rules" title="The rules you are about to test">
    <ul>
      <li>
        Each partition is assigned to exactly one consumer in the group. When a consumer fails or a new one joins, partitions move: a
        rebalance.{cite("consumer-javadoc")}
      </li>
      <li>
        A consumer that crashes or stops heartbeating for the session timeout is considered dead.{cite("consumer-javadoc")} One that keeps
        heartbeating but doesn&apos;t call <code>poll()</code> within <code>max.poll.interval.ms</code> (5 minutes by default) is considered
        failed too.{cite("consumer-configs")}
      </li>
      <li>
        A replacement starts from the committed offset.{cite("consumer-javadoc")} Commit after processing and a crash means duplicates; commit
        before processing and a crash means skipped records.{cite("design")}
      </li>
    </ul>
    <p>Pick an answer on each card, then open the simulator at the moment that settles it. Timeouts there are shortened; the card says how.</p>
  </WriteupSection>
);

export const predictions: Prediction[] = [
  {
    scenario: "scale-out",
    t: 16400,
    question: "A group of three reads a topic with three partitions. A fourth consumer joins. What does it get?",
    setup: "The topic orders has three partitions. consumer-3 joins at 6 s, consumer-4 at 16 s.",
    options: [
      { text: "A share of every partition." },
      { text: "Nothing. It sits idle.", correct: true },
      { text: "The busiest partition, taken from its owner." },
    ],
    explain: (
      <>
        Each partition has exactly one owner in the group,{cite("consumer-javadoc")} so a group can&apos;t keep more consumers busy than there
        are partitions. <code>kafka-consumer-groups.sh --describe --members</code> shows such a member with 0 partitions.{cite("ops")} It is a
        standby: if another member fails, it gets work.
      </>
    ),
  },
  {
    scenario: "crash-duplicates",
    t: 14100,
    question: "consumer-1 auto-commits every 5 s and is killed about 4 s after its last commit. Where does its replacement start?",
    setup: "Defaults: auto commit every 5 s. consumer-1 owns orders-0 and orders-1 and is killed at 9 s. Here the session timeout is 4.5 s.",
    options: [
      { text: "Exactly where consumer-1 stopped." },
      { text: "At the last committed offset, so about 4 s of records are processed again.", correct: true },
      { text: "At the newest record, skipping what consumer-1 hadn't finished." },
    ],
    explain: (
      <>
        A replacement recovers to the committed offset.{cite("consumer-javadoc")} Auto commit only runs every{" "}
        <code>auto.commit.interval.ms</code> (5000 ms by default),{cite("consumer-configs")} so everything processed since the last commit is
        processed again: at-least-once.{cite("design")} Nothing moves at all until the session timeout has passed.
      </>
    ),
  },
  {
    scenario: "at-most-once",
    t: 15600,
    question: "This time the consumer commits each batch as soon as it arrives, then processes it. It is killed mid-batch. What happens to the rest of that batch?",
    setup: "Commits before processing (enable.auto.commit=false, a commit as soon as a batch arrives), 0.5 s per record. consumer-1 is killed at 10 s.",
    options: [
      { text: "The next owner processes it." },
      { text: "Nobody ever processes it.", correct: true },
      { text: "Kafka redelivers the records nobody acknowledged after a timeout." },
    ],
    explain: (
      <>
        Saving the position before processing is at-most-once: if the consumer crashes after the commit and before processing, the
        replacement starts after those records.{cite("design")} Kafka keeps a single offset per partition, not an acknowledgement per record,
        {cite("design")} so nothing redelivers them.
      </>
    ),
  },
  {
    scenario: "hot-key",
    t: 15000,
    question: "70% of records share the key u1, and one consumer falls behind. Does adding consumers fix it?",
    setup: "Three consumers on three partitions, a record every 0.25 s, 0.4 s to process one.",
    options: [
      { text: "Yes: new consumers share the load on u1's partition." },
      { text: "No: every u1 record goes to one partition, and only one consumer in the group reads it.", correct: true },
      { text: "Yes, once the group uses the consumer protocol." },
    ],
    explain: (
      <>
        Records with the same key go to the same partition,{cite("intro")} and with three partitions murmur2 puts every <code>u1</code> on{" "}
        <code>orders-1</code>.{cite("partitioner-java")} That partition has one owner in the group,{cite("consumer-javadoc")} so its lag only
        drains as fast as that one consumer. More consumers sit idle; more partitions would move keys, as the first step showed.
      </>
    ),
  },
];

const after = (
  <Callout title="What this lab simplifies">
    <ul>
      <li>The simulator runs in slow motion with shortened timeouts; each card gives the one it uses.</li>
      <li>One topic with three unreplicated partitions. Replication is the previous lab; the simulator&apos;s write-up lists the rest.</li>
    </ul>
  </Callout>
);

/** Lab: four predictions about consumer groups, each checked in the consumer groups simulator. */
export function Body() {
  return (
    <Prose>
      {intro}
      <section className="space-y-6">
        {predictions.map((p, i) => (
          <Predict key={p.scenario} n={i + 1} prediction={p} simHref={simHref} />
        ))}
      </section>
      {after}
    </Prose>
  );
}
