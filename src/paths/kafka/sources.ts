import type { SourceSet } from "@/lib/sources";

const A = "2026-11-24";
const SRC = "https://github.com/apache/kafka/blob/4.4.0";

/**
 * Every reference the Kafka path may cite. Each step takes the ones it cites with
 * `pickSources(pool, [...])`, in its own first-citation order, so its numbering starts
 * at [1]. Quotes behind each claim are in the `kafka-facts` skill.
 */
export const pool: SourceSet = {
  subject: "Apache Kafka",
  version: "4.4",
  label: "Kafka 4.4",
  versionNote:
    "Config names, defaults and protocol names are from the Kafka 4.4 documentation and the 4.4.0 source. Where the classic and the KIP-848 consumer protocols differ, the text names the protocol.",
  checked: A,
  officialSources: ["https://kafka.apache.org/", "https://github.com/apache/kafka/", "https://cwiki.apache.org/confluence/display/KAFKA/"],
  references: [
    {
      id: "intro",
      title: "Introduction: topics, partitions and event keys",
      publisher: "Apache Kafka 4.4 documentation",
      url: "https://kafka.apache.org/44/getting-started/introduction/",
      accessed: A,
      covers: ["partition", "event key"],
    },
    {
      id: "log-impl",
      title: "Implementation: the log (offsets are monotonically increasing integers unique to a partition)",
      publisher: "Apache Kafka 4.4 documentation",
      url: "https://kafka.apache.org/44/implementation/log/",
      accessed: A,
      covers: ["offset"],
    },
    {
      id: "partitioner-java",
      title: "BuiltInPartitioner.java (partitionForKey) and Utils.java (murmur2), tag 4.4.0",
      publisher: "Apache Kafka source code",
      url: `${SRC}/clients/src/main/java/org/apache/kafka/clients/producer/internals/BuiltInPartitioner.java`,
      accessed: A,
      covers: ["murmur2", "partitionForKey", "toPositive"],
    },
    {
      id: "producer-configs",
      title: "Producer configs",
      publisher: "Apache Kafka 4.4 documentation",
      url: "https://kafka.apache.org/44/configuration/producer-configs/",
      accessed: A,
      covers: ["acks", "partitioner.class", "partitioner.ignore.keys", "batch.size", "linger.ms", "enable.idempotence"],
    },
    {
      id: "ops",
      title: "Basic Kafka operations: modifying topics, managing consumer groups",
      publisher: "Apache Kafka 4.4 documentation",
      url: "https://kafka.apache.org/44/operations/basic-kafka-operations/",
      accessed: A,
      covers: ["__consumer_offsets", "kafka-consumer-groups", "kafka-consumer-groups.sh", "LAG"],
    },
    {
      id: "design",
      title: "Design: the producer, the consumer, delivery semantics, replication",
      publisher: "Apache Kafka 4.4 documentation",
      url: "https://kafka.apache.org/44/design/design/",
      accessed: A,
      covers: ["acks", "Fetch", "fetch", "long poll", "at-most-once", "at-least-once", "min.insync.replicas", "replica.lag.time.max.ms"],
    },
    {
      id: "protocol",
      title: "Kafka protocol guide: Produce, Fetch, OffsetCommit and OffsetFetch APIs, error codes",
      publisher: "Apache Kafka 4.4 documentation",
      url: "https://kafka.apache.org/44/design/protocol/",
      accessed: A,
      covers: [
        "Produce", "Fetch", "OffsetCommit", "OffsetFetch", "fetch_offset", "high_watermark", "base_offset", "acks",
        "NOT_ENOUGH_REPLICAS", "NOT_COORDINATOR", "LeaveGroup",
      ],
    },
    {
      id: "partition-scala",
      title: "core/src/main/scala/kafka/cluster/Partition.scala (4.4.0): high watermark, ISR, acks=-1 completion",
      publisher: "Apache Kafka source code",
      url: `${SRC}/core/src/main/scala/kafka/cluster/Partition.scala`,
      accessed: A,
      covers: ["maybeIncrementLeaderHW", "updateFollowerFetchState"],
    },
    {
      id: "broker-configs",
      title: "Broker configs",
      publisher: "Apache Kafka 4.4 documentation",
      url: "https://kafka.apache.org/44/configuration/broker-configs/",
      accessed: A,
      covers: ["replica.lag.time.max.ms", "replica.fetch.wait.max.ms", "broker.session.timeout.ms", "group.consumer.session.timeout.ms"],
    },
    {
      id: "topic-configs",
      title: "Topic configs",
      publisher: "Apache Kafka 4.4 documentation",
      url: "https://kafka.apache.org/44/configuration/topic-configs/",
      accessed: A,
      covers: ["min.insync.replicas", "unclean.leader.election.enable"],
    },
    {
      id: "kip-101",
      title: "KIP-101: Alter Replication Protocol to use Leader Epoch rather than High Watermark for Truncation",
      publisher: "Apache Kafka Improvement Proposals",
      url: "https://cwiki.apache.org/confluence/display/KAFKA/KIP-101+-+Alter+Replication+Protocol+to+use+Leader+Epoch+rather+than+High+Watermark+for+Truncation",
      accessed: A,
      covers: [],
    },
    {
      id: "consumer-javadoc",
      title: "KafkaConsumer.java: offsets and consumer position, consumer groups, detecting consumer failures (tag 4.4.0)",
      publisher: "Apache Kafka source code",
      url: `${SRC}/clients/src/main/java/org/apache/kafka/clients/consumer/KafkaConsumer.java`,
      accessed: A,
      covers: ["poll", "position", "committed", "session.timeout.ms", "max.poll.interval.ms"],
    },
    {
      id: "consumer-configs",
      title: "Consumer configs",
      publisher: "Apache Kafka 4.4 documentation",
      url: "https://kafka.apache.org/44/configuration/consumer-configs/",
      accessed: A,
      covers: ["fetch.max.wait.ms", "max.poll.records", "enable.auto.commit", "auto.commit.interval.ms", "session.timeout.ms", "max.poll.interval.ms", "group.protocol"],
    },
    {
      id: "kip-848",
      title: "KIP-848: The Next Generation of the Consumer Rebalance Protocol",
      publisher: "Apache Kafka Improvement Proposals",
      url: "https://cwiki.apache.org/confluence/display/KAFKA/KIP-848%3A+The+Next+Generation+of+the+Consumer+Rebalance+Protocol",
      accessed: A,
      covers: ["__consumer_offsets", "ConsumerGroupHeartbeat"],
    },
  ],
};
