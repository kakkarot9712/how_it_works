import type { SimDefinition } from "@/sims/types";
import { Canvas } from "./canvas/Canvas";
import { Inspector } from "./inspector/Inspector";
import { COMMIT_MODES, defaultComponents, defaultSettings, model, nodeIds, type Action, type Components, type Event, type Settings, type State } from "./model";
import { scenarios } from "./scenarios";
import { sources } from "./sources";

export const kafkaConsumerGroups: SimDefinition<State, Event, Action, Settings, Components> = {
  model,
  defaults: { settings: defaultSettings, components: defaultComponents },
  scenarios,
  Canvas,
  Inspector,
  sources,
  nodeIds,
  timeNote:
    "Slow motion: a network hop takes 0.15s and a record takes 0.25s to process. Timeouts are scaled down to fit a 30-second run (session timeout 4.5s instead of 45s, max.poll.interval.ms 6s instead of 5 minutes, heartbeats every 1s, max.poll.records 5 instead of 500).",
  components: [
    {
      key: "keyPartitioning",
      label: "Partition by key",
      help: "partitioner.ignore.keys=false (the default): murmur2(key) % partitions, so one key's records stay in one partition, in order. Remove it and the producer ignores keys: a key's records spread over all partitions and are processed out of order.",
    },
    {
      key: "incremental",
      label: "Incremental rebalancing",
      help: "group.protocol=consumer (KIP-848): only partitions that move are revoked and reassigned, one heartbeat at a time. Remove it for the classic protocol's default eager RangeAssignor: every rebalance stops the whole group.",
    },
    {
      key: "deadLetter",
      label: "Dead-letter handling",
      help: "Application code, not Kafka: a record the handler throws on is parked in orders.dlq and the consumer moves on. Remove it and the application retries the record forever, so its partition stops.",
    },
  ],
  settings: [
    { key: "commitMode", label: "Offset commits", min: 0, max: 2, step: 1, choices: COMMIT_MODES, help: "Auto commit (every auto.commit.interval.ms, inside poll), commitSync after processing each batch (at-least-once), or before processing it (at-most-once)." },
    { key: "consumers", label: "Consumers at start", min: 1, max: 4, step: 1, help: "How many of the four consumers are running when the run starts. Start the others from their panels." },
    { key: "produceEveryMs", label: "Gap between records", min: 100, max: 1500, step: 50, unit: "ms", help: "How often the producer sends a record." },
    { key: "processMs", label: "Processing time", min: 50, max: 1500, step: 50, unit: "ms", help: "How long the application takes per record." },
    { key: "hotKeyPct", label: "Share of records keyed u1", min: 0, max: 90, step: 10, unit: "%", help: "0 spreads records evenly over six keys. Higher makes u1 a hot key, and its partition a hot partition." },
    { key: "maxPollRecords", label: "max.poll.records", min: 1, max: 20, step: 1, help: "Most records one poll() hands to the application (scaled; real default 500)." },
    { key: "maxPollIntervalMs", label: "max.poll.interval.ms", min: 2000, max: 20000, step: 500, unit: "ms", help: "Longest gap between poll() calls before the consumer leaves the group (scaled; real default 300000)." },
    { key: "sessionMs", label: "Session timeout", min: 2000, max: 15000, step: 500, unit: "ms", help: "How long the coordinator waits for a heartbeat before removing a member (scaled; real default 45000 in both protocols)." },
    { key: "heartbeatMs", label: "Heartbeat interval", min: 300, max: 3000, step: 100, unit: "ms", help: "How often a member heartbeats (scaled; real defaults 3000 classic, 5000 consumer protocol)." },
    { key: "autoCommitMs", label: "auto.commit.interval.ms", min: 1000, max: 10000, step: 500, unit: "ms", help: "How often auto commit commits positions (default 5000)." },
    { key: "latencyMs", label: "Network hop", min: 50, max: 400, step: 10, unit: "ms", help: "One-way latency (slow motion)." },
  ],
};
