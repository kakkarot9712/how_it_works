import type { SimDefinition } from "@/sims/types";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { defaultComponents, defaultSettings, model, type Action, type Components, type Event, type Settings, type State } from "./model";
import { scenarios } from "./scenarios";

export const redisPubSub: SimDefinition<State, Event, Action, Settings, Components> = {
  model,
  defaults: { settings: defaultSettings, components: defaultComponents },
  scenarios,
  Canvas,
  Inspector,
  timeNote: "Slow motion: a network hop takes ~0.45s here. On a real LAN it takes well under a millisecond.",
  components: [
    {
      key: "limits",
      label: "Output buffer limits",
      help: "client-output-buffer-limit pubsub. Remove it and a stuck subscriber can eat all of Redis's memory.",
    },
    {
      key: "reconnect",
      label: "Client auto-reconnect",
      help: "The client library's reconnect + re-SUBSCRIBE loop. Remove it and a dropped consumer stays gone.",
    },
    {
      key: "pattern",
      label: "Pattern subscriber",
      help: "fraud-check using PSUBSCRIBE pay*: gets payments via a glob pattern.",
    },
  ],
  settings: [
    { key: "softKb", label: "Soft limit", min: 2, max: 64, step: 1, unit: " KB", help: "Close if above this for the soft duration." },
    { key: "softSeconds", label: "Soft duration", min: 1, max: 30, step: 1, unit: "s", help: "How long above the soft limit is tolerated." },
    { key: "hardKb", label: "Hard limit", min: 4, max: 128, step: 1, unit: " KB", help: "Close immediately above this." },
    { key: "window", label: "TCP window", min: 1, max: 8, step: 1, unit: " msgs", help: "Kernel socket buffers, in messages. Data beyond this waits in Redis. Throughput per subscriber is capped at window ÷ round-trip time." },
    { key: "latencyMs", label: "Network hop", min: 150, max: 1200, step: 50, unit: "ms", help: "One-way latency (slow motion)." },
    { key: "headroomKb", label: "Host memory headroom", min: 16, max: 256, step: 8, unit: " KB", help: "RAM left before the OOM killer acts (scaled)." },
  ],
};
