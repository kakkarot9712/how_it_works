import type { Scenario } from "@/sims/types";
import type { Action, Components, Settings } from "./model";

export const scenarios: Scenario<Action, Settings, Components>[] = [
  {
    id: "happy",
    title: "Healthy: produce, fetch, commit",
    summary:
      "The producer writes to broker-1, the leader. broker-2 and broker-3 pull each record with Fetch requests. Once both have it, the high watermark moves past it and the acks=all producer gets its acknowledgement.",
    watchFor: [
      "Fetch requests go from the followers to the leader: replication is pull, not push.",
      "A record turns solid (committed) only after the next fetch from every follower tells the leader they have it.",
      "The ack comes back after that, so acks=all costs about two network round trips.",
    ],
    script: [],
    select: "broker-1",
    flow: [
      { at: 0, nodes: ["producer", "broker-1"], note: "The producer writes only to the partition leader, broker-1." },
      { at: 1500, nodes: ["broker-1", "broker-2", "broker-3"], note: "Followers pull: each Fetch carries the offset it wants next, and so tells the leader how far it got." },
      { at: 5000, nodes: ["producer", "broker-1", "broker-2", "broker-3"], note: "Once every in-sync replica has a record, the high watermark passes it and the producer gets its ack." },
    ],
  },
  {
    id: "slow-follower",
    title: "A follower stalls: the ISR shrinks",
    summary:
      "At 4 s broker-3's replica fetcher stalls; it still heartbeats, so the controller sees nothing wrong. acks=all writes wait for it until replica.lag.time.max.ms runs out and the leader drops it from the ISR. It catches up and rejoins after 16 s.",
    watchFor: [
      "acks=all writes pile up in broker-1's purgatory while the high watermark waits for broker-3.",
      "After replica.lag.time.max.ms (5 s here) the leader shrinks the ISR to 1,2 and the waiting writes are acknowledged at once.",
      "Once broker-3 fetches again and reaches the high watermark, it rejoins the ISR.",
    ],
    script: [
      { at: 4000, action: { type: "set-stall", b: 3, on: true } },
      { at: 16000, action: { type: "set-stall", b: 3, on: false } },
    ],
    select: "broker-3",
    flow: [
      { at: 0, nodes: ["broker-1", "broker-3"], note: "Watch broker-3. Its replica fetcher is about to stall." },
      { at: 4000, nodes: ["producer", "broker-1", "broker-3"], note: "broker-3 stopped fetching: acks=all writes wait, because the high watermark waits for it." },
      { at: 10000, nodes: ["broker-1", "broker-3", "controller"], note: "replica.lag.time.max.ms passed: the leader drops broker-3 from the ISR, and the writes go through." },
      { at: 16000, nodes: ["broker-1", "broker-3"], note: "broker-3 fetches again. Once it reaches the high watermark, it is back in the ISR." },
    ],
  },
  {
    id: "acks1-loss",
    title: "acks=1: acknowledged, then lost",
    summary:
      "The producer uses acks=1. At 5 s both followers' fetchers stall, so new records exist only on broker-1, which acks them anyway. broker-1 crashes at 8 s. The controller elects broker-2, which never got those records: the producer was told they were written, and they are gone.",
    watchFor: [
      "With acks=1 the ack comes back straight after the leader's own append; the followers' logs fall behind.",
      "After broker-1 is fenced, broker-2 (still in the ISR) becomes leader without the newest records.",
      "When broker-1 comes back it truncates the records the new leader doesn't have.",
    ],
    settings: { acks: 1 },
    script: [
      { at: 5000, action: { type: "set-stall", b: 2, on: true } },
      { at: 5000, action: { type: "set-stall", b: 3, on: true } },
      { at: 8000, action: { type: "crash", b: 1 } },
      { at: 10500, action: { type: "set-stall", b: 2, on: false } },
      { at: 10500, action: { type: "set-stall", b: 3, on: false } },
      { at: 18000, action: { type: "restart", b: 1 } },
    ],
    select: "producer",
    flow: [
      { at: 0, nodes: ["producer", "broker-1"], note: "acks=1: the leader acknowledges a record as soon as it is in its own log." },
      { at: 5000, nodes: ["producer", "broker-1", "broker-2", "broker-3"], note: "The followers stop fetching. broker-1 keeps acking records only it has." },
      { at: 8000, nodes: ["broker-1", "controller"], note: "broker-1 crashes. The controller fences it once broker.session.timeout.ms passes." },
      { at: 11000, nodes: ["controller", "broker-2", "producer"], note: "broker-2 leads now, without the newest records. The producer's list shows them as lost." },
      { at: 18000, nodes: ["broker-1", "broker-2"], note: "broker-1 restarts and truncates the records the new leader never had." },
    ],
  },
  {
    id: "acks-all",
    title: "acks=all: the same failure, nothing lost",
    summary:
      "The same failure as the previous scenario, with acks=all. While the followers are stalled the high watermark can't move, so broker-1 holds the acknowledgements back. When it crashes, the producer retries those records on broker-2 and nothing acknowledged is lost.",
    watchFor: [
      "After 5 s writes wait in broker-1's purgatory instead of being acknowledged.",
      "broker-1 crashes before replica.lag.time.max.ms, so the ISR still holds all three: the producer can't tell yet which records made it.",
      "After the election the producer resends the unacknowledged records to broker-2. lost stays at 0.",
    ],
    script: [
      { at: 5000, action: { type: "set-stall", b: 2, on: true } },
      { at: 5000, action: { type: "set-stall", b: 3, on: true } },
      { at: 8000, action: { type: "crash", b: 1 } },
      { at: 10500, action: { type: "set-stall", b: 2, on: false } },
      { at: 10500, action: { type: "set-stall", b: 3, on: false } },
      { at: 18000, action: { type: "restart", b: 1 } },
    ],
    select: "producer",
    flow: [
      { at: 0, nodes: ["producer", "broker-1"], note: "Same failure as before, but with acks=all." },
      { at: 5000, nodes: ["producer", "broker-1", "broker-2", "broker-3"], note: "Followers stall: the high watermark stops, so broker-1 holds the acks back." },
      { at: 8000, nodes: ["broker-1", "controller", "producer"], note: "broker-1 crashes. Its unacknowledged records go back to the producer's buffer." },
      { at: 11000, nodes: ["controller", "broker-2", "producer"], note: "broker-2 leads. The producer resends; nothing it was told is written goes missing." },
      { at: 18000, nodes: ["broker-1", "broker-2"], note: "broker-1 comes back and drops the records that were never committed." },
    ],
  },
  {
    id: "min-isr",
    title: "min.insync.replicas=2: refuse rather than risk",
    summary:
      "min.insync.replicas=2 with acks=all, the typical durable setup. broker-3 crashes at 4 s: the ISR is 1,2, still enough. broker-2 crashes at 11 s: the ISR is just broker-1, so the leader rejects writes with NOT_ENOUGH_REPLICAS until broker-2 is back and caught up.",
    watchFor: [
      "One broker down: writes carry on with ISR 1,2.",
      "Two down: every write gets NOT_ENOUGH_REPLICAS. The producer retries; nothing is acknowledged that only one broker has.",
      "Writes resume once broker-2 rejoins the ISR.",
    ],
    settings: { minIsr: 2 },
    script: [
      { at: 4000, action: { type: "crash", b: 3 } },
      { at: 11000, action: { type: "crash", b: 2 } },
      { at: 19000, action: { type: "restart", b: 2 } },
    ],
    select: "broker-1",
    flow: [
      { at: 0, nodes: ["broker-1", "controller"], note: "min.insync.replicas=2: an acks=all write needs at least two replicas in the ISR." },
      { at: 4000, nodes: ["broker-3", "controller", "broker-1"], note: "broker-3 crashes. The ISR drops to 1,2: still two, so writes go on." },
      { at: 11000, nodes: ["broker-2", "controller", "broker-1"], note: "broker-2 crashes too. The ISR is just broker-1." },
      { at: 13600, nodes: ["producer", "broker-1"], note: "Every write is rejected with NOT_ENOUGH_REPLICAS. The producer retries." },
      { at: 19000, nodes: ["broker-2", "broker-1", "producer"], note: "broker-2 is back. Once it catches up and rejoins the ISR, writes succeed again." },
    ],
  },
  {
    id: "offline",
    title: "The last in-sync replica dies: offline",
    summary:
      "Default settings (min.insync.replicas=1). At 3 s both followers' fetchers stall; after replica.lag.time.max.ms the ISR is just broker-1, and acks=all still succeeds. broker-1 crashes at 13 s. With unclean.leader.election.enable=false the partition has no leader until broker-1 returns at 21 s.",
    watchFor: [
      "The ISR shrinks to 1, and writes keep being acknowledged: min.insync.replicas=1 allows it.",
      "After broker-1 is fenced, the controller has nobody eligible: the partition is offline and the producer can't write.",
      "broker-1 comes back with every acknowledged record and leads again. Nothing is lost, but the partition was down.",
    ],
    script: [
      { at: 3000, action: { type: "set-stall", b: 2, on: true } },
      { at: 3000, action: { type: "set-stall", b: 3, on: true } },
      { at: 13000, action: { type: "crash", b: 1 } },
      { at: 14000, action: { type: "set-stall", b: 2, on: false } },
      { at: 14000, action: { type: "set-stall", b: 3, on: false } },
      { at: 21000, action: { type: "restart", b: 1 } },
    ],
    select: "controller",
    flow: [
      { at: 0, nodes: ["broker-1", "broker-2", "broker-3"], note: "Default min.insync.replicas=1. Both followers are about to stall." },
      { at: 10000, nodes: ["broker-1", "controller"], note: "The ISR is just broker-1, and acks=all still succeeds: one replica is enough at min ISR 1." },
      { at: 13000, nodes: ["broker-1", "controller"], note: "broker-1, the only in-sync replica, crashes." },
      { at: 15400, nodes: ["controller", "producer"], note: "No eligible leader and unclean election is off: the partition is offline. Writes fail." },
      { at: 21000, nodes: ["broker-1", "controller", "producer"], note: "broker-1 is back, still holding every acknowledged record, and leads again." },
    ],
  },
  {
    id: "unclean",
    title: "Unclean election: available, but acked data is gone",
    summary:
      "The same as the previous scenario, with unclean.leader.election.enable=true. When broker-1 is fenced, the controller makes broker-2 leader although it was out of the ISR. Writes resume quickly, but every record broker-1 acknowledged after the ISR shrank is lost.",
    watchFor: [
      "The election picks broker-2 from outside the ISR and forces the ISR to just broker-2.",
      "The producer's list marks acknowledged records as lost.",
      "When broker-1 returns it truncates its log to broker-2's: the last copies of those records are deleted.",
    ],
    settings: { unclean: 1 },
    script: [
      { at: 3000, action: { type: "set-stall", b: 2, on: true } },
      { at: 3000, action: { type: "set-stall", b: 3, on: true } },
      { at: 13000, action: { type: "crash", b: 1 } },
      { at: 14000, action: { type: "set-stall", b: 2, on: false } },
      { at: 14000, action: { type: "set-stall", b: 3, on: false } },
      { at: 21000, action: { type: "restart", b: 1 } },
    ],
    select: "controller",
    flow: [
      { at: 0, nodes: ["broker-1", "broker-2", "broker-3"], note: "unclean.leader.election.enable=true in this run. Both followers are about to stall." },
      { at: 10000, nodes: ["broker-1", "controller"], note: "The ISR is just broker-1; it keeps acknowledging records only it has." },
      { at: 13000, nodes: ["broker-1", "controller"], note: "broker-1 crashes." },
      { at: 15400, nodes: ["controller", "broker-2", "producer"], note: "Unclean election: broker-2 leads from outside the ISR. Acknowledged records are lost." },
      { at: 21000, nodes: ["broker-1", "broker-2"], note: "broker-1 returns and truncates its log to broker-2's, deleting the last copies." },
    ],
  },
];
