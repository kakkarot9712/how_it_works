import type { Scenario } from "@/sims/types";
import type { Action, Components, Settings } from "./model";

export const scenarios: Scenario<Action, Settings, Components>[] = [
  {
    id: "happy",
    title: "Healthy: keys, partitions, pull",
    summary:
      "The producer hashes each record's key to pick one of three partitions. Two consumers split the partitions between them, pull with long-polling fetches, and auto-commit their offsets every 5 s. Lag stays near zero.",
    watchFor: [
      "The same key always lands on the same partition: u1 and u3 on orders-1, for example.",
      "Each partition belongs to exactly one consumer in the group; consumer-1 owns two of them.",
      "Committed offsets trail the log end by a few records between auto commits: that gap is the lag.",
    ],
    script: [],
    select: "orders-1",
    flow: [
      { at: 0, nodes: ["consumer-1", "consumer-2", "coordinator"], note: "Both consumers join the group; the coordinator splits the three partitions between them." },
      { at: 3000, nodes: ["producer", "orders-0", "orders-1", "orders-2"], note: "murmur2(key) % 3 picks the partition: the same key always goes to the same one." },
      { at: 6000, nodes: ["orders-0", "orders-1", "orders-2", "consumer-1", "consumer-2"], note: "Consumers pull. A fetch with nothing new waits at the broker (long poll) until a record arrives." },
      { at: 10000, nodes: ["consumer-1", "consumer-2", "coordinator"], note: "Every auto.commit.interval.ms the consumers commit their positions to the coordinator." },
    ],
  },
  {
    id: "scale-out",
    title: "Scale out: a fourth consumer sits idle",
    summary:
      "consumer-3 joins at 6 s: the coordinator moves exactly one partition to it, and the other consumers keep working. consumer-4 joins at 16 s, but three partitions can't be split four ways: it gets nothing.",
    watchFor: [
      "Only the partition that moves stops, for a moment: revoked by its old owner first, then assigned.",
      "consumer-2 is never interrupted.",
      "consumer-4 is a member with no partitions. A group's parallelism is capped by the partition count.",
    ],
    script: [
      { at: 6000, action: { type: "start", c: 3 } },
      { at: 16000, action: { type: "start", c: 4 } },
    ],
    select: "coordinator",
    flow: [
      { at: 0, nodes: ["consumer-1", "consumer-2", "coordinator"], note: "Two consumers share three partitions: consumer-1 has two." },
      { at: 6000, nodes: ["consumer-3", "coordinator", "consumer-1"], note: "consumer-3 joins. The new target takes one partition from consumer-1, and only that one." },
      { at: 9000, nodes: ["consumer-1", "consumer-2", "consumer-3"], note: "One partition each. consumer-2 never stopped." },
      { at: 16000, nodes: ["consumer-4", "coordinator"], note: "consumer-4 joins, but there is no fourth partition: it stays idle." },
    ],
  },
  {
    id: "crash-duplicates",
    title: "A consumer crashes: at-least-once",
    summary:
      "consumer-1 is killed at 9 s, four seconds after its last auto commit. Nothing happens until its session times out; then consumer-2 takes its partitions from the last committed offset and processes those four seconds of records again.",
    watchFor: [
      "Lag climbs on consumer-1's partitions while the coordinator still waits for a heartbeat.",
      "After the session timeout the partitions move, starting at the committed offset, not where consumer-1 stopped.",
      "The records between the two are processed twice: duplicates, not loss.",
    ],
    script: [
      { at: 9000, action: { type: "crash", c: 1 } },
      { at: 21000, action: { type: "start", c: 1 } },
    ],
    select: "consumer-2",
    flow: [
      { at: 0, nodes: ["consumer-1", "coordinator"], note: "consumer-1 auto-commits every 5 s. Watch how far its committed offsets trail." },
      { at: 9000, nodes: ["consumer-1", "orders-0", "orders-1"], note: "consumer-1 is killed. Its partitions stop moving; lag builds." },
      { at: 13000, nodes: ["coordinator", "consumer-2"], note: "Session timeout: the coordinator removes consumer-1 and gives its partitions to consumer-2." },
      { at: 14500, nodes: ["consumer-2", "orders-0", "orders-1"], note: "consumer-2 starts at the committed offsets and repeats what consumer-1 did after them." },
      { at: 21000, nodes: ["consumer-1", "coordinator", "consumer-2"], note: "consumer-1 restarts and rejoins; one partition moves back to it." },
    ],
  },
  {
    id: "at-most-once",
    title: "Commit before processing: at-most-once",
    summary:
      "The consumers commit each batch as soon as it arrives, then process it. consumer-1 is killed at 10 s halfway through a batch. Those records are already committed, so consumer-2 starts after them: they are never processed.",
    watchFor: [
      "With commits first, a partition's committed offset runs ahead of what has been processed.",
      "consumer-2 picks up from the committed offset and skips the rest of consumer-1's batch.",
      "Lost records show red on the partition tape; there are no duplicates.",
    ],
    settings: { commitMode: 2, processMs: 500 },
    script: [{ at: 10000, action: { type: "crash", c: 1 } }],
    select: "orders-1",
    flow: [
      { at: 0, nodes: ["consumer-1", "coordinator"], note: "Each batch is committed the moment it arrives, before it is processed." },
      { at: 10000, nodes: ["consumer-1", "orders-0", "orders-1"], note: "consumer-1 dies mid-batch. The rest of that batch is committed but not done." },
      { at: 14000, nodes: ["coordinator", "consumer-2", "orders-0", "orders-1"], note: "consumer-2 starts at the committed offsets. The unprocessed records are skipped: lost." },
    ],
  },
  {
    id: "stop-the-world",
    title: "Classic protocol: everyone stops",
    summary:
      "The same scale-out, on the classic protocol with the default eager RangeAssignor. When consumer-3 joins at 6 s, every member revokes all its partitions and rejoins, and no one consumes until the new assignment arrives.",
    watchFor: [
      "consumer-2 stops too, though it ends up owning a partition again.",
      "Lag rises on all three partitions during the rebalance, not just the one that moves.",
      "Compare with “Scale out”, where only one partition paused.",
    ],
    components: { incremental: false },
    script: [{ at: 6000, action: { type: "start", c: 3 } }],
    select: "coordinator",
    flow: [
      { at: 0, nodes: ["consumer-1", "consumer-2", "coordinator"], note: "Classic group, RangeAssignor: consumer-1 owns orders-0 and orders-1, consumer-2 owns orders-2." },
      { at: 6000, nodes: ["consumer-3", "coordinator"], note: "consumer-3 sends JoinGroup: the coordinator starts a rebalance (PreparingRebalance)." },
      { at: 7000, nodes: ["consumer-1", "consumer-2", "coordinator"], note: "Heartbeats answer REBALANCE_IN_PROGRESS: both revoke everything and rejoin. Nothing is consumed." },
      { at: 7500, nodes: ["consumer-1", "consumer-2", "consumer-3"], note: "Everyone has rejoined: one partition each, and consumption resumes." },
    ],
  },
  {
    id: "slow-consumer",
    title: "Too slow for max.poll.interval.ms",
    summary:
      "consumer-1 commits after processing each batch. At 4 s its processing gets 6× slower, so a batch of five takes longer than max.poll.interval.ms. It is pushed out of the group, its commit fails, and it rejoins with a partition it is still too slow for.",
    watchFor: [
      "consumer-1 still heartbeats: the session never expires. The poll timer is what catches it.",
      "It leaves the group mid-batch and keeps processing; its commit is then rejected (CommitFailedException).",
      "Whoever takes over redoes that batch: duplicates, and a rebalance every cycle.",
    ],
    settings: { commitMode: 1 },
    script: [{ at: 4000, action: { type: "slow", c: 1, factor: 6 } }],
    select: "consumer-1",
    flow: [
      { at: 0, nodes: ["consumer-1", "coordinator"], note: "consumer-1 commits after each batch (commitSync), then polls for the next one." },
      { at: 4000, nodes: ["consumer-1"], note: "Each record now takes 1.5 s: a batch of five takes 7.5 s, over max.poll.interval.ms (6 s)." },
      { at: 14000, nodes: ["consumer-1", "coordinator", "consumer-2"], note: "Poll timeout: consumer-1 leaves the group, and consumer-2 takes its partitions." },
      { at: 17000, nodes: ["consumer-1", "coordinator"], note: "consumer-1 finally polls: its commit is rejected, and it rejoins." },
    ],
  },
  {
    id: "poison",
    title: "A poison record jams the group",
    summary:
      "At 5 s the producer sends a record the consumer code throws on. consumer-2 retries it forever: orders-2 stops while the others flow. After max.poll.interval.ms it is pushed out, consumer-1 takes orders-2, hits the same record and jams too.",
    watchFor: [
      "Only orders-2's lag grows at first: a partition is processed in order, so one bad record blocks everything behind it.",
      "Heartbeats keep going; the poll timer is what removes consumer-2.",
      "The partition moves, the poison moves with it, and consumer-1 jams too. Then the whole group is stuck.",
    ],
    components: { deadLetter: false },
    script: [{ at: 5000, action: { type: "poison", p: 2 } }],
    select: "orders-2",
    flow: [
      { at: 0, nodes: ["producer", "orders-2", "consumer-2"], note: "consumer-2 owns orders-2. The handler has no dead-letter path: it retries a failing record forever." },
      { at: 5000, nodes: ["producer", "orders-2"], note: "A record the handler can't process lands on orders-2." },
      { at: 6000, nodes: ["orders-2", "consumer-2"], note: "consumer-2 retries it over and over. orders-2's lag climbs; the other partitions are fine." },
      { at: 11500, nodes: ["consumer-2", "coordinator", "consumer-1"], note: "Poll timeout: consumer-2 leaves and orders-2 moves to consumer-1, poison included." },
      { at: 19000, nodes: ["consumer-1", "orders-0", "orders-1", "orders-2"], note: "consumer-1 is stuck too, then pushed out: no one consumes any partition." },
    ],
  },
  {
    id: "hot-key",
    title: "A hot key: one partition, one consumer",
    summary:
      "70% of records carry key u1. Keys pin records to a partition, so orders-1 gets most of the traffic and its one consumer falls behind, while the other two are mostly idle. More consumers would not help.",
    watchFor: [
      "orders-1's log grows several times faster than the others.",
      "Its lag keeps climbing; the other partitions' lag stays near zero.",
      "Only one consumer in the group can read a partition, so the hot partition's speed is one consumer's speed.",
    ],
    settings: { consumers: 3, hotKeyPct: 70, produceEveryMs: 250, processMs: 400 },
    script: [],
    select: "orders-1",
    flow: [
      { at: 0, nodes: ["producer", "orders-1"], note: "Most records carry key u1, and murmur2(u1) % 3 = 1: they all go to orders-1." },
      { at: 8000, nodes: ["orders-1", "consumer-1", "consumer-2", "consumer-3"], note: "orders-1's consumer is busy all the time; the others mostly wait on empty fetches." },
      { at: 18000, nodes: ["orders-1"], note: "Lag on orders-1 keeps growing. Adding consumers would not change it." },
    ],
  },
];
