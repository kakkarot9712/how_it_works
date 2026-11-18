import type { SimDefinition } from "@/sims/types";
import { Canvas } from "./canvas/Canvas";
import { Inspector } from "./inspector/Inspector";
import { defaultComponents, defaultSettings, model, nodeIds, type Action, type Components, type Event, type Settings, type State } from "./model";
import { scenarios } from "./scenarios";
import { sources } from "./sources";

export const kafkaReplication: SimDefinition<State, Event, Action, Settings, Components> = {
  model,
  defaults: { settings: defaultSettings, components: defaultComponents },
  scenarios,
  Canvas,
  Inspector,
  sources,
  nodeIds,
  timeNote:
    "Slow motion: a network hop takes 0.25s. Timeouts are scaled down to fit a 30-second run (replica.lag.time.max.ms 5s instead of 30s, broker.session.timeout.ms 3s instead of 9s, request.timeout.ms 10s instead of 30s).",
  components: [
    {
      key: "isrShrink",
      label: "ISR shrinking",
      help: "The leader drops a follower that hasn't caught up for replica.lag.time.max.ms. Remove it (as if that timeout were endless) and one stuck follower holds every acks=all write.",
    },
    {
      key: "retries",
      label: "Producer retries",
      help: "retries=2147483647 (the default). Remove it (retries=0) and every failed send, even a retriable one during a failover, is an error for the application.",
    },
    {
      key: "idempotence",
      label: "Idempotent producer",
      help: "enable.idempotence=true (the default, with acks=all): a resent record is written once. Remove it and a resend after a lost answer can write it twice.",
    },
  ],
  settings: [
    { key: "acks", label: "acks", min: 0, max: 2, step: 1, choices: ["0", "1", "all"], help: "When the leader answers the producer. Also switchable live in the producer's panel." },
    { key: "minIsr", label: "min.insync.replicas", min: 1, max: 3, step: 1, help: "ISR size needed to accept an acks=all write, and for the high watermark to move." },
    { key: "unclean", label: "unclean.leader.election.enable", min: 0, max: 1, step: 1, choices: ["false", "true"], help: "Let the controller elect a replica outside the ISR when no in-sync one is alive." },
    { key: "intervalMs", label: "Gap between records", min: 200, max: 1500, step: 50, unit: "ms", help: "How often the producer sends a record." },
    { key: "latencyMs", label: "Network hop", min: 100, max: 600, step: 10, unit: "ms", help: "One-way latency (slow motion)." },
    { key: "lagMaxMs", label: "replica.lag.time.max.ms", min: 2000, max: 15000, step: 500, unit: "ms", help: "How long a follower may go without catching up before the leader drops it from the ISR (scaled; real default 30000)." },
    { key: "sessionMs", label: "broker.session.timeout.ms", min: 1500, max: 9000, step: 500, unit: "ms", help: "How long the controller waits for a heartbeat before fencing a broker (scaled; real default 9000)." },
    { key: "fetchWaitMs", label: "replica.fetch.wait.max.ms", min: 100, max: 2000, step: 50, unit: "ms", help: "How long the leader holds a follower's fetch when it has nothing new (default 500)." },
    { key: "requestTimeoutMs", label: "request.timeout.ms", min: 3000, max: 30000, step: 500, unit: "ms", help: "How long the producer waits for an answer before resending (scaled; real default 30000)." },
  ],
};
