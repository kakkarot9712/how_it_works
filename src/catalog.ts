/**
 * What the site covers. Server-safe (no React, no sim code), used by pages,
 * navigation and metadata. A sim marked "live" must have an entry in
 * src/sims/registry.tsx with the same `${tech}/${slug}` id.
 */

export type SimStatus = "live" | "planned";

export interface SimEntry {
  slug: string;
  title: string;
  summary: string;
  status: SimStatus;
  /** Concept tags, used for cross-linking (e.g. "push vs pull"). */
  concepts: string[];
}

export interface Topic {
  slug: string;
  name: string;
  kind: "technology" | "concept";
  tagline: string;
  sims: SimEntry[];
}

export const topics: Topic[] = [
  {
    slug: "redis",
    name: "Redis",
    kind: "technology",
    tagline: "In-memory data structure server",
    sims: [
      {
        slug: "pub-sub",
        title: "Pub/Sub",
        summary:
          "Fire-and-forget fan-out. Stall a subscriber, cut its network or crash Redis, and see where messages go: client output buffers, soft and hard limits, half-open connections.",
        status: "live",
        concepts: ["push delivery", "at-most-once", "backpressure"],
      },
      {
        slug: "streams",
        title: "Streams & consumer groups",
        summary:
          "An append-only log with consumer groups. Kill, hang or poison a consumer and watch the pending entries list (PEL), XACK, XAUTOCLAIM, dead-lettering and MAXLEN trimming.",
        status: "live",
        concepts: ["log", "at-least-once", "consumer groups"],
      },
    ],
  },
  {
    slug: "kafka",
    name: "Kafka",
    kind: "technology",
    tagline: "Distributed, partitioned commit log",
    sims: [
      {
        slug: "produce-and-replicate",
        title: "Produce & replicate",
        summary: "Partitioner, leader and followers pulling (fetching) from the leader, ISR, high watermark, acks=0/1/all, min.insync.replicas, leader failover.",
        status: "planned",
        concepts: ["pull delivery", "replication", "durability"],
      },
      {
        slug: "consumer-groups",
        title: "Consumer groups",
        summary: "Pull-based consumers, lag, offset commits, rebalancing, and why a slow consumer never hurts the broker.",
        status: "planned",
        concepts: ["pull delivery", "at-least-once", "backpressure"],
      },
    ],
  },
  {
    slug: "load-balancing",
    name: "Load balancing",
    kind: "concept",
    tagline: "Spreading requests across servers",
    sims: [
      {
        slug: "algorithms",
        title: "Algorithms side by side",
        summary: "Round robin, weighted, least connections, power of two choices, under uneven servers and slow requests.",
        status: "planned",
        concepts: ["load balancing", "tail latency"],
      },
      {
        slug: "consistent-hashing",
        title: "Consistent hashing",
        summary: "The hash ring, virtual nodes, and how many keys move when a node joins or leaves.",
        status: "planned",
        concepts: ["partitioning", "load balancing"],
      },
    ],
  },
  {
    slug: "consensus",
    name: "Consensus & replication",
    kind: "concept",
    tagline: "How replicas agree on a leader and a log",
    sims: [
      {
        slug: "raft",
        title: "Raft leader election",
        summary: "Terms, randomized election timeouts, votes, split votes, log replication and commit index under partitions.",
        status: "planned",
        concepts: ["consensus", "replication"],
      },
      {
        slug: "mongodb-replica-set",
        title: "MongoDB replica set",
        summary: "Primary election, oplog replication, write concern majority, and rollback after a failover.",
        status: "planned",
        concepts: ["consensus", "replication", "durability"],
      },
    ],
  },
  {
    slug: "transactions",
    name: "Transactions",
    kind: "concept",
    tagline: "ACID, isolation levels, MVCC",
    sims: [
      {
        slug: "isolation-levels",
        title: "Isolation levels & anomalies",
        summary: "Two transactions on parallel timelines: dirty reads, non-repeatable reads, lost updates and write skew at each isolation level.",
        status: "planned",
        concepts: ["ACID", "MVCC", "isolation"],
      },
      {
        slug: "wal-durability",
        title: "WAL & crash recovery",
        summary: "Why a committed transaction survives a crash: write-ahead log, fsync, checkpoints and replay.",
        status: "planned",
        concepts: ["ACID", "durability"],
      },
    ],
  },
];

export function getTopic(slug: string): Topic | undefined {
  return topics.find((t) => t.slug === slug);
}

export function getSim(topic: string, sim: string): { topic: Topic; sim: SimEntry } | undefined {
  const t = getTopic(topic);
  const s = t?.sims.find((x) => x.slug === sim);
  return t && s ? { topic: t, sim: s } : undefined;
}
