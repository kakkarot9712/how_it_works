import { AnnotatedConfig, Callout, citer, Compare, Figure, Prose, TryIt, WriteupSection } from "@/components/writeup";
import type { WriteupMeta } from "@/sims/explainers";
import { scenarios } from "../scenarios";
import { sources } from "../sources";
import { ReplicationDiagram } from "./ReplicationDiagram";

export const meta: WriteupMeta = {
  title: "How Kafka replication actually works",
  lede: "Followers pull the leader's log, and a record is committed once every in-sync replica has it. acks decides whether the producer waits for that; the ISR, min.insync.replicas and unclean election decide what survives a broker failure.",
  facts: [
    { label: "Replication", value: "followers pull" },
    { label: "Commit point", value: "high watermark" },
    { label: "Default acks", value: "all" },
    { label: "Durable setup", value: "min ISR 2 of 3" },
  ],
  sections: [
    { id: "path", title: "The path of one record" },
    { id: "isr", title: "The ISR and slow followers" },
    { id: "acks", title: "acks: when the producer is told" },
    { id: "min-isr", title: "min.insync.replicas" },
    { id: "failover", title: "Leader failover" },
    { id: "unclean", title: "Unclean leader election" },
    { id: "producer", title: "Retries and idempotence" },
    { id: "choosing", title: "Choosing settings" },
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

const cite = citer(sources);

/** Long-form write-up for /kafka/produce-and-replicate/how-it-works (server component). */
export function Explainer({ simHref }: { simHref: string }) {
  return (
    <Prose>
      <WriteupSection id="path" title="The path of one record">
        <p>
          Kafka replicates each partition of a topic across a number of brokers, the replication factor. One replica is the
          leader and the others are followers; all writes go to the leader.{cite("design")} The producer sends records
          straight to the leader&apos;s broker, using metadata any broker can answer about where the leaders are.
          {cite("design")}
        </p>
        <p>
          Followers are not sent the data. They pull it: each follower fetches from the leader the way a consumer does
          and appends what it gets to its own log.{cite("design")} Its Fetch request names the offset it wants next
          (<code>fetch_offset</code>), and the answer carries the records after it and the leader&apos;s high watermark
          (<code>high_watermark</code>),{cite("protocol")} the offset below which records are committed.
          {cite("partition-scala")}
        </p>
        <Figure
          caption={
            <ol className="list-decimal space-y-1 pl-5">
              <li>The producer sends a record to the leader, which appends it to its log.{cite("design")}</li>
              <li>
                A follower&apos;s Fetch returns the record. Its <em>next</em> fetch asks for the offset after it, and that is
                how the leader learns the follower has it.{cite("partition-scala")}
              </li>
              <li>
                The leader moves the high watermark to the smallest log end offset in the ISR. Here broker-3 has only
                fetched up to offset 5, so the high watermark stays at 5.{cite("partition-scala")}
              </li>
              <li>
                Records below the high watermark are committed: only they are given to consumers.{cite("design")} An{" "}
                <code>acks=all</code> producer is answered when the high watermark passes its record.{cite("partition-scala")}
              </li>
            </ol>
          }
        >
          <ReplicationDiagram />
        </Figure>
        <p>
          While the leader has nothing new, it can hold a follower&apos;s fetch for up to{" "}
          <code>replica.fetch.wait.max.ms</code> (default 500 ms) instead of answering at once.{cite("broker-configs")} So
          a healthy follower usually has a fetch waiting on the leader, and a new record goes out to it straight away.
        </p>
        <TryIt simHref={simHref} items={see("happy")} />
      </WriteupSection>

      <WriteupSection id="isr" title="The ISR and slow followers">
        <p>
          The leader tracks the set of in-sync replicas, the ISR. A write is not committed until every replica in it has
          the write, and only ISR members are eligible to be elected leader.{cite("design")} The controller removes a
          broker that loses its session; the leader itself removes a follower that is alive but has fallen behind.
          {cite("design")}
        </p>
        <p>
          &quot;Behind&quot; is measured in time: a follower that hasn&apos;t caught up to the leader&apos;s log end
          offset for <code>replica.lag.time.max.ms</code> (default 30 s) is dropped.{cite("broker-configs")} The leader
          logs it:{cite("partition-scala")}
        </p>
        <AnnotatedConfig
          parts={[
            { token: "Shrinking ISR from 1,2,3 to 1,2.", label: "new ISR", tone: "warn" },
            { token: "Leader: (highWatermark: 41, endOffset: 44).", label: "leader's offsets" },
            { token: "Out of sync replicas: (brokerId: 3, …).", label: "who was dropped", tone: "err" },
          ]}
        />
        <p>
          Until then, a stuck follower holds back the high watermark, and with it every <code>acks=all</code> write. Once
          it is out, the high watermark moves on without it. It rejoins once its log end offset reaches the high watermark
          again.{cite("partition-scala")}
        </p>
        <TryIt simHref={simHref} items={see("slow-follower")} />
      </WriteupSection>

      <WriteupSection id="acks" title="acks: when the producer is told">
        <ul>
          <li>
            <code>acks=0</code>: the producer doesn&apos;t wait for any answer. Retries have no effect, and the offset it
            reports for each record is -1.{cite("producer-configs")}
          </li>
          <li>
            <code>acks=1</code>: the leader answers once the record is in its own log. If it fails right after, before any
            follower has the record, the record is lost.{cite("producer-configs")}
          </li>
          <li>
            <code>acks=all</code> (the default, same as <code>-1</code>): the leader waits for the full set of in-sync
            replicas. The record survives as long as one in-sync replica does.{cite("producer-configs")}
          </li>
        </ul>
        <p>
          Whatever the producer chose, consumers only see a record once it is committed.{cite("design")} So{" "}
          <code>acks=1</code> doesn&apos;t make data visible sooner; it only tells the producer &quot;written&quot; before it
          is safe.
        </p>
        <Callout tone="warn" title="An acknowledged write can vanish">
          <p>
            With <code>acks=1</code>, a leader that crashes right after acknowledging takes the newest records with it. The
            new leader is a perfectly healthy ISR member; it just never got them.{cite("producer-configs")}
          </p>
        </Callout>
        <TryIt simHref={simHref} items={see("acks1-loss", "acks-all")} />
      </WriteupSection>

      <WriteupSection id="min-isr" title="min.insync.replicas">
        <p>
          <code>acks=all</code> waits for the <em>current</em> ISR. If the ISR has shrunk to the leader alone,{" "}
          <code>acks=all</code> writes still succeed, and they can be lost if that last replica fails too.{cite("design")}
        </p>
        <p>
          <code>min.insync.replicas</code> (default 1) sets a floor. With <code>acks=all</code> and fewer in-sync replicas
          than that, the producer gets an exception: <code>NotEnoughReplicas</code> or{" "}
          <code>NotEnoughReplicasAfterAppend</code>.{cite("topic-configs")} The leader checks before appending, so the
          rejected record is never written.{cite("partition-scala")} On the wire it is error 19,{" "}
          <code>NOT_ENOUGH_REPLICAS</code>, and it is retriable.{cite("protocol")}
        </p>
        <p>
          The topic docs give the typical durable setup: replication factor 3, <code>min.insync.replicas=2</code>,
          producers with <code>acks=all</code>.{cite("topic-configs")} One broker can be down and writes carry on; with two
          down, the partition refuses writes rather than keep data on a single copy.
        </p>
        <p>
          The floor also applies to the high watermark, whatever the <code>acks</code>: it only advances while the ISR has
          at least <code>min.insync.replicas</code> members.{cite("partition-scala", "kip-966")} An <code>acks=1</code>{" "}
          write is still acknowledged, but consumers won&apos;t see it until the ISR recovers.{cite("kip-966")}
        </p>
        <TryIt simHref={simHref} items={see("min-isr")} />
      </WriteupSection>

      <WriteupSection id="failover" title="Leader failover">
        <p>
          Each broker keeps a session with the controller by heartbeating. If the controller hears nothing for{" "}
          <code>broker.session.timeout.ms</code> (default 9 s), the broker is considered offline.{cite("design", "broker-configs")}{" "}
          The controller fences it, logging{" "}
          <code>Fencing broker 1 at epoch … because its session has timed out.</code>, and removes it from every ISR and
          leadership.{cite("rcm-java")}
        </p>
        <p>
          For each partition the fenced broker led, the controller picks a new leader from the first group below that has
          a live replica:{cite("pcb-java", "elr")}
        </p>
        <ol>
          <li>
            <strong>The ISR.</strong> These replicas have every committed record, so nothing is lost.
          </li>
          <li>
            <strong>The Eligible Leader Replicas</strong> (Kafka 4.0+, on by default for new clusters from 4.1). They are
            out of the ISR but still have every committed record (see below), so nothing is lost either.
          </li>
          <li>
            <strong>Any live replica</strong>, but only if unclean leader election is enabled. It may be missing
            committed records (see the next section).
          </li>
        </ol>
        <p>
          If no group has a live replica, the partition stays without a leader, and producers can&apos;t write to it,
          until one comes back.{cite("pcb-java")}
        </p>
        <h3>What an Eligible Leader Replica is</h3>
        <p>
          An Eligible Leader Replica (ELR) is a replica that is <em>no longer in the ISR</em> but is still guaranteed to
          have every committed record, everything below the high watermark. The controller keeps this list per
          partition; brokers don&apos;t see it.{cite("kip-966")}
        </p>
        <p>
          The rule that makes the guarantee possible: while the ISR is smaller than <code>min.insync.replicas</code>, the
          high watermark can&apos;t move, so no new record is committed.{cite("elr")} So when a replica leaves the ISR
          and the ISR drops below the minimum, the replica has everything committed so far, and nothing more is
          committed while the ISR stays below the minimum. The controller adds it to the ELR. When the ISR is back at the minimum, the ELR is
          cleared, because commits resume and the ELR replicas fall behind.{cite("kip-966")}
        </p>
        <p>
          An example with replication factor 3 and <code>min.insync.replicas=2</code>:
        </p>
        <ul>
          <li>
            <strong>Start:</strong> ISR = 1, 2, 3 (broker 1 leads). ELR is empty.
          </li>
          <li>
            <strong>Broker 3 falls behind and leaves.</strong> ISR = 1, 2, still at the minimum, so records keep being
            committed without broker 3. Broker 3 is missing them, so it is <em>not</em> eligible.
          </li>
          <li>
            <strong>Broker 2 leaves too.</strong> ISR = 1, below the minimum: the high watermark freezes. Broker 2 has
            every record committed up to now, so it becomes an ELR. ELR = 2.
          </li>
          <li>
            <strong>Broker 1 fails.</strong> ISR is empty; broker 1 joins the ELR too (ELR = 1, 2), but it is down. The
            controller elects broker 2 from the ELR (once it is live), and no committed record is lost. Broker 3 could
            only lead through an unclean election.
          </li>
        </ul>
        <p>
          Every leader change starts a new leader epoch, and every record carries the epoch it was written in. A replica
          that returns as a follower truncates its log at the point where it diverges from the new leader&apos;s, then
          fetches from there.{cite("kip-101")} That is where records the old leader acknowledged but nobody else had
          disappear for good.
        </p>
        <TryIt simHref={simHref} items={see("acks1-loss", "offline")} />
      </WriteupSection>

      <WriteupSection id="unclean" title="Unclean leader election">
        <p>
          If every in-sync replica is gone, Kafka can wait for one of them to come back, or take the first replica that
          is alive even though it may be missing committed records. Since 0.11.0.0 it waits by default.{cite("design")}{" "}
          <code>unclean.leader.election.enable=true</code> switches to the second choice.{cite("topic-configs")}
        </p>
        <p>
          The controller then forces the ISR to just the new leader and logs{" "}
          <code>Setting new leader … using an unclean election</code>.{cite("pcb-java")} The new leader&apos;s log becomes
          the source of truth.{cite("design")} An operator can also force one for a partition with no leader:{" "}
          <code>kafka-leader-election.sh --election-type unclean</code>.{cite("leader-election-cmd")}
        </p>
        <Callout tone="warn" title="Available or consistent: pick one">
          <p>
            With unclean election off, a partition whose in-sync replicas are all down is unavailable until one returns,
            and permanently if their data is gone. With it on, the partition comes back at once, minus the records only
            those replicas had.{cite("design")}
          </p>
        </Callout>
        <TryIt simHref={simHref} items={see("offline", "unclean")} />
      </WriteupSection>

      <WriteupSection id="producer" title="Retries and idempotence">
        <p>
          A failover shows up at the producer as retriable errors such as <code>NOT_LEADER_OR_FOLLOWER</code>.
          {cite("protocol")} By default the producer retries (<code>retries</code> 2147483647), backing off from{" "}
          <code>retry.backoff.ms</code>, until <code>delivery.timeout.ms</code> (default 2 minutes) runs out.
          {cite("producer-configs")} If no answer comes within <code>request.timeout.ms</code> (default 30 s), it resends.
          {cite("producer-configs")}
        </p>
        <p>
          A resend can duplicate a record whose first copy did arrive. <code>enable.idempotence=true</code>, the default,
          makes the producer write exactly one copy. It needs <code>acks=all</code>, <code>retries</code> above 0 and{" "}
          <code>max.in.flight.requests.per.connection</code> at most 5; with a conflicting setting and idempotence not set
          explicitly, it is turned off.{cite("producer-configs")}
        </p>
        <TryIt simHref={simHref} items={see("acks-all")} />
      </WriteupSection>

      <WriteupSection id="choosing" title="Choosing settings">
        <Compare
          head={["", "acks=0", "acks=1", "acks=all"]}
          rows={[
            ["Producer waits for", "nothing", "the leader's log", "every in-sync replica"],
            ["Offset in the answer", "-1", "yes", "yes"],
            ["Leader crashes after the answer", "may be lost", "may be lost", "kept, if an in-sync replica survives"],
            ["Retries", "no effect", "yes", "yes, idempotent by default"],
          ]}
        />
        <p className="text-note">Source: the producer configuration reference.{cite("producer-configs")}</p>
        <ul>
          <li>
            Replication factor 3 is a common production setting.{cite("intro")} With <code>min.insync.replicas=2</code> and{" "}
            <code>acks=all</code>, a write is on at least two brokers before anyone is told it succeeded.
            {cite("topic-configs")}
          </li>
          <li>
            Keep <code>request.timeout.ms</code> above <code>replica.lag.time.max.ms</code>: the docs advise it to reduce
            duplicates from unnecessary producer retries.{cite("producer-configs")}
          </li>
          <li>
            Leave <code>unclean.leader.election.enable</code> off unless uptime is preferable to consistency.
            {cite("design", "topic-configs")} This page models Kafka 4.4.0, released October 22, 2026.{cite("downloads")}
          </li>
        </ul>
      </WriteupSection>

      <WriteupSection id="simplifies" title="What this simulation simplifies">
        <Callout title="Model vs reality">
          <ul>
            <li>
              Time runs in slow motion: a network hop takes 0.25 s. <code>replica.lag.time.max.ms</code> is 5 s instead of
              30 s, <code>broker.session.timeout.ms</code> 3 s instead of 9 s, <code>request.timeout.ms</code> 10 s instead
              of 30 s, and <code>delivery.timeout.ms</code> 20 s instead of 2 minutes. Heartbeats keep the real ratio to
              the session timeout.
            </li>
            <li>
              One topic with one partition. The producer sends one record per request, with no batching (
              <code>linger.ms</code>, <code>batch.size</code>), and a Fetch carries at most 5 records.
            </li>
            <li>
              The producer&apos;s metadata refresh, the leader&apos;s AlterPartition request and the controller&apos;s
              updates to brokers are instant and not drawn. Brokers that can reach the controller learn a new leader at
              once.
            </li>
            <li>
              A crash keeps the broker&apos;s log intact, as if every write had been flushed. A real crash can lose
              unflushed data; Kafka then makes the replica re-sync before it rejoins the ISR, and drops it from the ELR.
            </li>
            <li>
              Truncation compares the two logs directly; Kafka finds the divergence point through leader epochs in the
              fetch protocol.
            </li>
            <li>The idempotent producer is modelled as &quot;the leader already has this record, so don&apos;t append it again&quot;, not as producer IDs and sequence numbers.</li>
            <li>
              The controller is one node that never fails. In KRaft it is a quorum of its own; leader election for the
              metadata log is a separate topic.
            </li>
            <li>Narration shortens Kafka&apos;s log lines to their message text.</li>
          </ul>
        </Callout>
      </WriteupSection>
    </Prose>
  );
}
