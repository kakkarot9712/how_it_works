import { Predict, type Prediction } from "@/components/path";
import { citer, Prose, simplifier, WriteupSection } from "@/components/writeup";
import { pickSources } from "@/lib/sources";
import { pool } from "../sources";

export const sources = pickSources(pool, [
  "design",
  "broker-configs",
  "topic-configs",
  "producer-configs",
  "partition-scala",
  "protocol",
  "kip-101",
]);
const cite = citer(sources);
const simplified = simplifier(sources);
export const simHref = "/kafka/produce-and-replicate";

const intro = (
  <WriteupSection id="rules" title="The rules you are about to test">
    <ul>
      <li>
        The leader keeps the set of in-sync replicas, the <strong>ISR</strong>.
        A follower that can&apos;t catch up to the end of the leader&apos;s log
        within <code>replica.lag.time.max.ms</code> is removed from it.
        {cite("design")} The default is 30000 ms.
        {cite("broker-configs")}
      </li>
      <li>
        A broker whose heartbeats stop for{" "}
        <code>broker.session.timeout.ms</code> is considered offline by the
        controller, which removes it from the ISR.{cite("design")} The default
        is 9000 ms.{cite("broker-configs")}
      </li>
      <li>
        Only ISR members can be elected leader,{cite("design")} unless{" "}
        <code>unclean.leader.election.enable</code> is turned on (it is off by
        default).{cite("topic-configs")}
      </li>
      <li>
        <code>acks=1</code>: the leader answers once the record is in its own
        log. <code>acks=all</code>: it waits for the full set of in-sync
        replicas.{cite("producer-configs")}
      </li>
    </ul>
    <p>
      Each card below sets up a situation. Pick what you think happens, then
      open the simulator at the moment that settles it. The simulator runs in
      slow motion with shorter timeouts; each card says which.
    </p>
  </WriteupSection>
);

export const predictions: Prediction[] = [
  {
    scenario: "slow-follower",
    t: 10300,
    question:
      "A follower stops fetching but keeps heartbeating. What happens to acks=all writes?",
    setup:
      "Defaults: three replicas, acks=all, min.insync.replicas=1. broker-3's replica fetcher stalls at 4 s. Here replica.lag.time.max.ms is 5 s.",
    options: [
      { text: "They fail at once with NOT_ENOUGH_REPLICAS." },
      {
        text: "They wait. After replica.lag.time.max.ms the leader drops broker-3 from the ISR, and the waiting writes are acknowledged together.",
        correct: true,
      },
      {
        text: "Nothing changes: the leader acknowledges without waiting for followers.",
      },
    ],
    explain: (
      <>
        With <code>acks=all</code> the leader acknowledges once all current
        in-sync replicas have the record,{cite("design")} and the high watermark
        is the smallest log end offset in the ISR,{cite("partition-scala")} so
        one stuck ISR member holds every write. Once broker-3 has been behind
        for <code>replica.lag.time.max.ms</code> it leaves the ISR, the high
        watermark jumps, and the waiting writes complete. Writes are refused
        with <code>NOT_ENOUGH_REPLICAS</code> only when the ISR is smaller than{" "}
        <code>min.insync.replicas</code>.{cite("protocol")}
      </>
    ),
  },
  {
    scenario: "acks1-loss",
    t: 11000,
    question:
      "acks=1, and the leader crashes before its followers copied its newest records. Are those acknowledged records safe?",
    setup:
      "acks=1. Both followers stop fetching at 5 s; broker-1, the leader, crashes at 8 s. broker-2 is still in the ISR and wins a clean election.",
    options: [
      {
        text: "Yes: broker-2 copies them from broker-1 when broker-1 comes back.",
      },
      {
        text: "Yes: the producer resends whatever the leader didn't replicate.",
      },
      {
        text: "No: they are lost, although the election was clean.",
        correct: true,
      },
    ],
    explain: (
      <>
        With <code>acks=1</code>, if the leader fails right after acknowledging
        a record but before the followers have replicated it, the record is
        lost.{cite("producer-configs")} The producer has its acknowledgement, so
        it has no reason to resend. The new leader&apos;s log is the truth from
        now on: when broker-1 returns as a follower it truncates its log to
        match, deleting the last copies.{cite("kip-101")}
      </>
    ),
  },
  {
    scenario: "acks-all",
    t: 18800,
    question:
      "The same failure with acks=all. How many acknowledged records are lost?",
    setup:
      "acks=all (the default). The same stalled followers and the same leader crash at 8 s.",
    options: [
      { text: "None.", correct: true },
      { text: "The same ones as with acks=1." },
      { text: "Everything written while the followers were stalled." },
    ],
    explain: (
      <>
        An <code>acks=all</code> acknowledgement means every in-sync replica had
        the record,{cite("producer-configs")} and a committed record is not lost
        while at least one in-sync replica stays alive.{cite("design")} The
        writes broker-1 was holding were never acknowledged: the producer
        retries them on the new leader, and the idempotent producer (
        <code>enable.idempotence</code>, on by default) keeps the retries from
        writing duplicates.{cite("producer-configs")} broker-1 still truncates
        its tail when it returns, but nothing there was acknowledged.
      </>
    ),
  },
  {
    scenario: "min-isr",
    t: 13950,
    question:
      "min.insync.replicas=2, and both followers die. What does the leader do with new acks=all writes?",
    setup:
      "min.insync.replicas=2, acks=all. broker-3 crashes at 4 s and broker-2 at 11 s. Here broker.session.timeout.ms is 3 s.",
    options: [
      {
        text: "Accepts and acknowledges them: it is the only replica left, so it is the whole ISR.",
      },
      {
        text: "Refuses them with NOT_ENOUGH_REPLICAS until a follower rejoins the ISR.",
        correct: true,
      },
      {
        text: "Holds them silently and acknowledges them when a follower comes back.",
      },
    ],
    explain: (
      <>
        When the dead brokers&apos; heartbeats stop, the controller removes them
        from the ISR.{cite("design")} With <code>acks=all</code> and an ISR
        below <code>min.insync.replicas</code>, the producer gets an exception
        instead of an acknowledgement,{cite("topic-configs")} error{" "}
        <code>NOT_ENOUGH_REPLICAS</code>: &ldquo;fewer in-sync replicas than
        required&rdquo;.{cite("protocol")} The partition is unavailable for
        writes rather than acknowledging records that only one broker has.
        {cite("design")}
      </>
    ),
  },
];

/** Lab: four predictions about replication, each checked in the produce and replicate simulator. */
export function Body() {
  return (
    <Prose>
      {intro}
      {simplified(
        ["broker-configs"],
        <>
          The simulator runs in slow motion, with timeouts shortened to seconds
          so failures play out quickly; each card below gives the value it uses.
          It has one partition, one producer and no consumers; its own write-up
          lists what else it leaves out.
        </>,
      )}
      <section className="space-y-6">
        {predictions.map((p, i) => (
          <Predict
            key={p.scenario}
            n={i + 1}
            prediction={p}
            simHref={simHref}
          />
        ))}
      </section>
    </Prose>
  );
}
