import type { ComponentType } from "react";
import { Explainer as RedisPubSub } from "./redis-pubsub/Explainer";
import { scenarios as redisPubSubScenarios } from "./redis-pubsub/scenarios";

export interface Writeup {
  /** Server-rendered long-form text for the "How it works" page. */
  Explainer: ComponentType;
  /** Scenario list, linked from the write-up into the simulator (?s=<id>). */
  scenarios: { id: string; title: string; summary: string }[];
}

export const writeups: Record<string, Writeup> = {
  "redis/pub-sub": { Explainer: RedisPubSub, scenarios: redisPubSubScenarios },
};
