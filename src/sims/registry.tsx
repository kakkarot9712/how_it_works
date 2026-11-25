"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { Player } from "@/player/Player";

/**
 * Client-side map from `${topic}/${sim}` to the playable simulation.
 * Each sim is its own chunk and is not server-rendered (it is driven by
 * requestAnimationFrame and has nothing useful to prerender).
 */
const loading = () => (
  <div className="flex h-full items-center justify-center text-sm text-fg-muted">Loading simulation…</div>
);

const sims: Record<string, ComponentType> = {
  "redis/pub-sub": dynamic(
    () =>
      import("./redis-pubsub").then((m) => {
        const Sim = () => <Player def={m.redisPubSub} />;
        return Sim;
      }),
    { ssr: false, loading },
  ),
  "redis/streams": dynamic(
    () =>
      import("./redis-streams").then((m) => {
        const Sim = () => <Player def={m.redisStreams} />;
        return Sim;
      }),
    { ssr: false, loading },
  ),
  "kafka/produce-and-replicate": dynamic(
    () =>
      import("./kafka-replication").then((m) => {
        const Sim = () => <Player def={m.kafkaReplication} />;
        return Sim;
      }),
    { ssr: false, loading },
  ),
  "kafka/consumer-groups": dynamic(
    () =>
      import("./kafka-consumer-groups").then((m) => {
        const Sim = () => <Player def={m.kafkaConsumerGroups} />;
        return Sim;
      }),
    { ssr: false, loading },
  ),
  "load-balancing/algorithms": dynamic(
    () =>
      import("./lb-algorithms").then((m) => {
        const Sim = () => <Player def={m.lbAlgorithms} />;
        return Sim;
      }),
    { ssr: false, loading },
  ),
  "transactions/isolation-levels": dynamic(
    () =>
      import("./pg-isolation").then((m) => {
        const Sim = () => <Player def={m.pgIsolation} />;
        return Sim;
      }),
    { ssr: false, loading },
  ),
};

export function SimMount({ id }: { id: string }) {
  const Sim = sims[id];
  if (!Sim) return <p className="p-8 text-sm text-fg-muted">This simulation is not built yet.</p>;
  return <Sim />;
}
