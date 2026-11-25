import { citer, Prose, simplifier, WriteupSection } from "@/components/writeup";
import { pickSources } from "@/lib/sources";
import { pool } from "../sources";
import { KeyPartitioner } from "../widgets/KeyPartitioner";

export const sources = pickSources(pool, [
  "intro",
  "log-impl",
  "design",
  "consumer-javadoc",
  "ops",
  "partitioner-java",
  "producer-configs",
]);
const cite = citer(sources);
const simplified = simplifier(sources);

/** Explore: keys, partitions and offsets, with Kafka's real partitioner in a widget. */
export function Body() {
  return (
    <Prose>
      <WriteupSection id="partitions" title="A topic is a set of logs">
        <p>
          A Kafka topic is partitioned: it is spread over a number of
          &ldquo;buckets&rdquo; located on different brokers, so clients can
          read and write to many brokers at the same time. A new record is
          appended to one of the topic&apos;s partitions.{cite("intro")}
        </p>
        <p>
          Each partition is its own log. A record&apos;s <strong>offset</strong>{" "}
          is its position in that log, and offsets are increasing integers
          unique to a partition.{cite("log-impl")} So <code>orders-1</code>{" "}
          offset 4 names exactly one record; offset 4 on its own does not.
        </p>
      </WriteupSection>

      <WriteupSection id="why" title="Why split a topic at all">
        <p>
          <strong>To spread the writes.</strong> All writes to a partition go to
          that partition&apos;s leader.{cite("design")} With one partition,
          every producer of the topic would be writing through one broker. With
          several, the partitions sit on different brokers, so clients can read
          and write the topic on many brokers at the same time.{cite("intro")}
        </p>
        <p>
          <strong>To spread the reading.</strong> A partition is also the unit
          that consumers share. Within a consumer group, each partition is read
          by exactly one consumer at a time, which keeps a consumer&apos;s
          progress in a partition down to a single number, its offset.
          {cite("design")} So a topic with four partitions can be read by up to
          four consumers of one group in parallel, each owning a share of the
          partitions.{cite("consumer-javadoc")} A fifth consumer in that group
          gets no partition and sits idle: Kafka&apos;s own example of
          describing a group shows a member with zero partitions.{cite("ops")}{" "}
          The consumers module comes back to this.
        </p>
        <p>
          <strong>The price is order.</strong> Each partition keeps its own
          order, and that is the only order Kafka promises. The next section
          shows how a key keeps related records together, in one partition, so
          they stay in order.
        </p>
      </WriteupSection>

      <WriteupSection id="keys" title="The key picks the partition">
        <p>
          When a record has a key and no explicit partition, the producer&apos;s
          built-in partitioner hashes the serialized key with murmur2 and takes
          it modulo the number of partitions:{" "}
          <code>toPositive(murmur2(key)) % numPartitions</code>.
          {cite("partitioner-java")} Without a key, or with{" "}
          <code>partitioner.ignore.keys=true</code>, it sticks to one partition
          and moves on after at least <code>batch.size</code> bytes have gone to
          it.{cite("producer-configs")}
        </p>
        <p>
          That is what keys are for. Records with the same key are written to
          the same partition, and any consumer of that partition reads them in
          exactly the order they were written.{cite("intro")} The promise is
          about one partition: the topic as a whole has no single order.
        </p>
        <KeyPartitioner />
        {simplified(
          ["producer-configs", "partitioner-java"],
          <>
            Records go straight into a partition: no batching, no broker and no
            replication; the next step follows one record through all of that.
            The widget hashes each key&apos;s UTF-8 bytes, while the producer
            hashes the <em>serialized</em> key, so a serializer that writes
            different bytes can pick a different partition.
          </>,
        )}
        <p>
          Send <code>u1…u9</code> twice. Every key lands in the same partition
          both times, and each partition numbers its records from 0 on its own.
          The widget runs a port of Kafka&apos;s murmur2, so these are the
          partitions a Java producer would pick for these keys.
        </p>
      </WriteupSection>

      <WriteupSection id="adding" title="Adding a partition moves keys">
        <p>
          The modulo has a cost. When a topic&apos;s partition count grows, the
          default partitioner&apos;s mapping changes, so records with the same
          key may go to a different partition than before, which affects
          ordering for existing keys. Kafka does not move the data already
          written.{cite("ops")}
        </p>
        <p>
          In the widget, send <code>u1…u9</code>, press{" "}
          <strong>+ Add a partition</strong>, then send <code>u1…u9</code>{" "}
          again. Below the logs, the widget lists every key whose partition
          changed: where it went before, where it goes now, and how many old
          records stayed behind. Click a key to light up its records in every
          partition. Its old records sit in one log and its new ones in another,
          starting after the <em>4 partitions →</em> marker, so no single
          partition holds that key&apos;s history in order any more.
        </p>
      </WriteupSection>

      <WriteupSection id="takeaways" title="What to take away">
        <ul>
          <li>
            <strong>
              The partition is the unit of order and of parallel work.
            </strong>{" "}
            Order holds inside one partition only, and within a consumer group
            each partition is read by one consumer at a time.
            {cite("intro", "consumer-javadoc")}
          </li>
          <li>
            <strong>The key picks the partition</strong>, by{" "}
            <code>toPositive(murmur2(key)) % numPartitions</code>, so the same
            key always lands in the same place while the count stays the same.
            {cite("partitioner-java")}
          </li>
          <li>
            <strong>Choose the partition count with care.</strong> Adding
            partitions moves keys, and a topic&apos;s partition count can&apos;t
            be reduced.{cite("ops")}
          </li>
        </ul>
      </WriteupSection>

      <WriteupSection id="what-if" title="What if…">
        <p>
          <strong>…you need one order across the whole topic?</strong> Then give
          it one partition: every record joins one log, in one order.
          {cite("intro")} The price is that every write goes through that
          partition&apos;s one leader,{cite("design")} and a consumer group can
          read it with only one consumer at a time.{cite("consumer-javadoc")}
        </p>
        <p>
          <strong>…two keys land in the same partition?</strong> They share its
          log. With 9 keys and 3 partitions, some must: <code>u1</code> and
          another key might both go to <code>orders-1</code>. Their records
          interleave there, but each key&apos;s own records still come out in
          the order they were written, because order holds within the partition.
          {cite("intro")}
        </p>
        <p>
          <strong>…you want fewer partitions later?</strong> You can&apos;t:
          Kafka does not support reducing a topic&apos;s partition count.
          {cite("ops")}
        </p>
      </WriteupSection>
    </Prose>
  );
}
