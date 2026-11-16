import Link from "next/link";
import type { SimEntry, Topic } from "@/catalog";
import { gloss, Heading, Pill, Surface, surfaceClass, Tag } from "@/components/ui";

/** A sim in a topic grid: links to the simulator when live, greyed out when planned. */
export function SimCard({ topic, sim }: { topic: Topic; sim: SimEntry }) {
  const live = sim.status === "live";
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <Heading level="item" as="h3">
          {sim.title}
        </Heading>
        <Pill size="sm" tone={live ? "ok" : "muted"}>
          {live ? "live" : "planned"}
        </Pill>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-fg-muted">{gloss(sim.summary, { focusable: !live })}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {sim.concepts.map((c) => (
          <Tag key={c} mono>
            {gloss(c, { focusable: !live })}
          </Tag>
        ))}
      </div>
    </>
  );
  return live ? (
    <Link href={`/${topic.slug}/${sim.slug}`} className={surfaceClass({ radius: "xl", interactive: true }, "block p-4")}>
      {body}
    </Link>
  ) : (
    <Surface radius="xl" className="p-4 opacity-60">
      {body}
    </Surface>
  );
}
