import type { SimDefinition } from "@/sims/types";
import { Canvas } from "./canvas/Canvas";
import { Inspector } from "./inspector/Inspector";
import { defaultComponents, defaultSettings, model, nodeIds, type Action, type Components, type Event, type Settings, type State } from "./model";
import { scenarios } from "./scenarios";
import { sources } from "./sources";

export const lbAlgorithms: SimDefinition<State, Event, Action, Settings, Components> = {
  model,
  defaults: { settings: defaultSettings, components: defaultComponents },
  scenarios,
  Canvas,
  Inspector,
  sources,
  nodeIds,
  timeNote:
    "Slow motion: a network hop takes 0.2s and a normal request 0.6s of work. Timeouts (fail_timeout, proxy_read_timeout) are scaled down to match.",
  components: [
    {
      key: "healthChecks",
      label: "Passive health checks",
      help: "max_fails / fail_timeout: after failed attempts, a server is skipped for a while. Remove it (max_fails=0) and nginx never stops trying a dead server.",
    },
    {
      key: "nextUpstream",
      label: "Retry on the next server",
      help: "proxy_next_upstream error timeout (the default). Remove it (off) and a failed attempt goes straight back to the client as 502 or 504.",
    },
    {
      key: "weights",
      label: "Server weights",
      help: "The weight= parameter on each server line. Remove it and every server counts as weight=1.",
    },
  ],
  settings: [
    { key: "intervalMs", label: "Average gap between requests", min: 100, max: 1500, step: 10, unit: "ms", help: "Random (exponential) gaps around this average." },
    { key: "heavyPct", label: "Heavy requests", min: 0, max: 50, step: 1, unit: "%", help: "Share of requests that are heavy." },
    { key: "heavyX", label: "Heavy request work", min: 2, max: 20, step: 1, unit: "×", help: "How many times the work of a normal request." },
    { key: "workers", label: "Workers per server", min: 1, max: 4, step: 1, help: "Requests a server handles at once. The rest wait in its queue." },
    { key: "latencyMs", label: "Network hop", min: 50, max: 600, step: 10, unit: "ms", help: "One-way latency (slow motion)." },
    { key: "maxFails", label: "max_fails", min: 1, max: 5, step: 1, help: "Failed attempts within fail_timeout before a server is skipped." },
    { key: "failTimeoutS", label: "fail_timeout", min: 1, max: 15, step: 1, unit: "s", help: "The window for counting failures, and how long a server is then skipped (scaled)." },
    { key: "readTimeoutS", label: "proxy_read_timeout", min: 2, max: 30, step: 1, unit: "s", help: "How long nginx waits for a response before giving up on a server (scaled)." },
    { key: "weight1", label: "api-1 weight", min: 1, max: 5, step: 1, help: "weight= for api-1." },
    { key: "weight2", label: "api-2 weight", min: 1, max: 5, step: 1, help: "weight= for api-2." },
    { key: "weight3", label: "api-3 weight", min: 1, max: 5, step: 1, help: "weight= for api-3." },
  ],
};
