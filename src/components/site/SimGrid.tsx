import type { Topic } from "@/catalog";
import { SimCard } from "./SimCard";

/** A topic's sims as a responsive card grid. */
export function SimGrid({ topic }: { topic: Topic }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {topic.sims.map((s) => (
        <SimCard key={s.slug} topic={topic} sim={s} />
      ))}
    </div>
  );
}
