import type { ComponentType } from "react";
import type { SourceSet } from "@/lib/sources";
import { Explainer as RedisPubSub, meta as redisPubSubMeta } from "./redis-pubsub/writeup/Explainer";
import { scenarios as redisPubSubScenarios } from "./redis-pubsub/scenarios";
import { walkthroughs as redisPubSubWalkthroughs } from "./redis-pubsub/walkthroughs";
import { Explainer as RedisStreams, meta as redisStreamsMeta } from "./redis-streams/writeup/Explainer";
import { scenarios as redisStreamsScenarios } from "./redis-streams/scenarios";
import { walkthroughs as redisStreamsWalkthroughs } from "./redis-streams/walkthroughs";
import { sources as redisStreamsSources } from "./redis-streams/sources";
import { sources as redisPubSubSources } from "./redis-pubsub/sources";
import { Explainer as PgIsolation, meta as pgIsolationMeta } from "./pg-isolation/writeup/Explainer";
import { scenarios as pgIsolationScenarios } from "./pg-isolation/scenarios";
import { walkthroughs as pgIsolationWalkthroughs } from "./pg-isolation/walkthroughs";
import { sources as pgIsolationSources } from "./pg-isolation/sources";

/** Header and navigation data for a write-up, exported by the sim's Explainer.tsx. */
export interface WriteupMeta {
  title: string;
  /** One or two sentences under the title. */
  lede: string;
  /** Short key facts shown as a strip in the header (3–4). */
  facts: { label: string; value: string }[];
  /** Top-level sections, in order. Each `id` matches a <Section id> in the Explainer. Drives the contents list. */
  sections: { id: string; title: string }[];
}

/** What happens in one scenario, moment by moment. Text supports `code` and **bold**. */
export interface Walkthrough {
  /** Scenario id. */
  id: string;
  /** What this scenario changes from the defaults. */
  setup: string;
  /** In order. `t` (simulated ms) makes the moment a deep link; `log` is a narration line the model must emit near `t`. */
  moments: { t?: number; log?: string; text: string }[];
  takeaway: string;
  /** Things to try in the simulator, naming real controls. */
  tryNext: string[];
}

export interface Writeup extends WriteupMeta {
  /** Server-rendered long-form text for the "How it works" page. `simHref` links into the simulator. */
  Explainer: ComponentType<{ simHref: string }>;
  /** Scenario list, linked from the write-up into the simulator (?s=<id>). */
  scenarios: { id: string; title: string; summary: string }[];
  /** One per scenario, same order. */
  walkthroughs: Walkthrough[];
  /** Version modelled and every source cited (the sim's sources.ts). Enforced by src/sims/sources.test.ts. */
  sources: SourceSet;
}

export const writeups: Record<string, Writeup> = {
  "redis/pub-sub": { ...redisPubSubMeta, Explainer: RedisPubSub, scenarios: redisPubSubScenarios, walkthroughs: redisPubSubWalkthroughs, sources: redisPubSubSources },
  "redis/streams": { ...redisStreamsMeta, Explainer: RedisStreams, scenarios: redisStreamsScenarios, walkthroughs: redisStreamsWalkthroughs, sources: redisStreamsSources },
  "transactions/isolation-levels": {
    ...pgIsolationMeta,
    Explainer: PgIsolation,
    scenarios: pgIsolationScenarios,
    walkthroughs: pgIsolationWalkthroughs,
    sources: pgIsolationSources,
  },
};
