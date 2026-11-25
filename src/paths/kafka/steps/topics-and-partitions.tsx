import { Callout, citer, Prose, WriteupSection } from "@/components/writeup";
import { pickSources } from "@/lib/sources";
import { pool } from "../sources";
import { KeyPartitioner } from "../widgets/KeyPartitioner";

export const sources = pickSources(pool, ["intro", "log-impl", "partitioner-java", "producer-configs", "ops"]);
const cite = citer(sources);

/** Explore: keys, partitions and offsets, with Kafka's real partitioner in a widget. */
export function Body() {
  return (
    <Prose>
      <WriteupSection id="partitions" title="A topic is a set of logs">
        <p>
          A Kafka topic is partitioned: it is spread over a number of &ldquo;buckets&rdquo; located on different brokers, so clients can read and
          write to many brokers at the same time. A new record is appended to one of the topic&apos;s partitions.{cite("intro")}
        </p>
        <p>
          Each partition is its own log. A record&apos;s <strong>offset</strong> is its position in that log, and offsets are increasing integers
          unique to a partition.{cite("log-impl")} So <code>orders-1</code> offset 4 names exactly one record; offset 4 on its own does not.
        </p>
      </WriteupSection>

      <WriteupSection id="keys" title="The key picks the partition">
        <p>
          When a record has a key and no explicit partition, the producer&apos;s built-in partitioner hashes the serialized key with murmur2 and
          takes it modulo the number of partitions: <code>toPositive(murmur2(key)) % numPartitions</code>.{cite("partitioner-java")} Without a
          key, or with <code>partitioner.ignore.keys=true</code>, it sticks to one partition and moves on after at least <code>batch.size</code>{" "}
          bytes have gone to it.{cite("producer-configs")}
        </p>
        <p>
          That is what keys are for. Records with the same key are written to the same partition, and any consumer of that partition reads them
          in exactly the order they were written.{cite("intro")} The promise is about one partition: the topic as a whole has no single order.
        </p>
        <KeyPartitioner />
        <p>
          Send <code>u1…u9</code> twice. Every key lands in the same partition both times, and each partition numbers its records from 0 on its
          own. The widget runs a port of Kafka&apos;s murmur2, so these are the partitions a Java producer would pick for these keys.
        </p>
      </WriteupSection>

      <WriteupSection id="adding" title="Adding a partition moves keys">
        <p>
          The modulo has a cost. When a topic&apos;s partition count grows, the default partitioner&apos;s mapping changes, so records with the same
          key may go to a different partition than before, which affects ordering for existing keys. Kafka does not move the data already
          written.{cite("ops")}
        </p>
        <p>
          In the widget, send <code>u1…u9</code>, press <strong>+ Add a partition</strong>, then send <code>u1…u9</code> again. Below the logs,
          the widget lists every key whose partition changed: where it went before, where it goes now, and how many old records stayed behind.
          Click a key to light up its records in every partition. Its old records sit in one log and its new ones in another, starting after the{" "}
          <em>4 partitions →</em> marker, so no single partition holds that key&apos;s history in order any more.
        </p>
      </WriteupSection>

      <Callout title="What this widget simplifies">
        <ul>
          <li>Records go straight into the partition. There is no batching, no broker and no replication here; the next step follows one record through all of that.</li>
          <li>The widget hashes each key&apos;s UTF-8 bytes. The partitioner hashes the serialized key, so a producer whose serializer writes different bytes for the same key can pick a different partition.</li>
        </ul>
      </Callout>
    </Prose>
  );
}
