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
};

export function SimMount({ id }: { id: string }) {
  const Sim = sims[id];
  if (!Sim) return <p className="p-8 text-sm text-fg-muted">This simulation is not built yet.</p>;
  return <Sim />;
}
