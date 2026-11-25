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
  /** Unreleased: left out of `topics`, so it is not listed and its URLs return 404. Tests still cover it. */
  hidden?: boolean;
  sims: SimEntry[];
}

/** Every topic, including hidden ones. Only tests should need this; pages use `topics`. */
export const allTopics: Topic[] = [
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
        summary:
          "One partition on three brokers: followers pull with Fetch, the ISR and high watermark, acks=0/1/all, min.insync.replicas, leader failover and unclean election. Stall a follower, crash the leader, and count the acknowledged records that survive.",
        status: "live",
        concepts: ["pull delivery", "replication", "durability"],
      },
      {
        slug: "consumer-groups",
        title: "Consumer groups",
        summary:
          "Keys hashed to partitions, one owner per partition, long-poll fetches, lag and offset commits. Crash, slow down or poison a consumer and see duplicates, lost records and rebalances, classic and incremental.",
        status: "live",
        concepts: ["pull delivery", "at-least-once", "backpressure"],
      },
    ],
  },
  {
    slug: "kubernetes",
    name: "Kubernetes",
    kind: "technology",
    hidden: true,
    tagline: "Container orchestration: an API server, controllers and kubelets",
    sims: [
      {
        slug: "reconcile-loops",
        title: "Controllers & reconcile loops",
        summary: "A Deployment, its ReplicaSet and Pods kept at the desired count. Delete Pods, stop the controller manager, scale up and down.",
        status: "planned",
        concepts: ["reconcile loop", "desired state"],
      },
      {
        slug: "scheduler",
        title: "kube-scheduler",
        summary: "Filtering and scoring nodes for each Pod, unschedulable Pods, and preemption by priority.",
        status: "planned",
        concepts: ["scheduling"],
      },
      {
        slug: "node-failure",
        title: "Node failure & eviction",
        summary: "Node heartbeats and leases, a node going silent, taint-based eviction and node-pressure eviction.",
        status: "planned",
        concepts: ["failure detection", "heartbeats"],
      },
    ],
  },
  {
    slug: "load-balancing",
    name: "Load balancing",
    kind: "concept",
    hidden: true,
    tagline: "Spreading requests across servers",
    sims: [
      {
        slug: "algorithms",
        title: "Algorithms side by side",
        summary:
          "Four nginx upstream groups on the same requests: round robin, random, least_conn and random two, with weights. Slow a server down, hang it or crash it and compare tail latency, retries and max_fails.",
        status: "live",
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
    hidden: true,
    tagline: "ACID, isolation levels, MVCC",
    sims: [
      {
        slug: "isolation-levels",
        title: "Isolation levels & anomalies",
        summary:
          "Two PostgreSQL sessions on parallel timelines: row versions and snapshots, non-repeatable reads, phantoms, lost updates, write skew, serialization failures and deadlocks at each isolation level.",
        status: "live",
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

/** Published topics: what the site lists, routes and prerenders. */
export const topics = allTopics.filter((t) => !t.hidden);

export function getTopic(slug: string): Topic | undefined {
  return topics.find((t) => t.slug === slug);
}

export function getSim(topic: string, sim: string): { topic: Topic; sim: SimEntry } | undefined {
  const t = getTopic(topic);
  const s = t?.sims.find((x) => x.slug === sim);
  return t && s ? { topic: t, sim: s } : undefined;
}
