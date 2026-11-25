import Link from "next/link";
import { pathMinutes, stepsOf, type LearningPath } from "@/paths/catalog";
import { Eyebrow, gloss, Heading, surfaceClass, Tag } from "@/components/ui";

/** A learning path as a card: what it covers, its modules, and how long it takes. */
export function PathCard({ path }: { path: LearningPath }) {
  return (
    <Link href={`/learn/${path.slug}`} className={surfaceClass({ radius: "xl", interactive: true }, "block p-5")}>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow tone="accent">Learning path · {path.name}</Eyebrow>
        <span className="font-mono text-xs text-fg-muted">
          {stepsOf(path).length} steps · ~{pathMinutes(path)} min
        </span>
      </div>
      <Heading level="card" as="h3" className="mt-2">
        {path.title}
      </Heading>
      <p className="mt-2 text-note leading-relaxed text-fg-muted">{gloss(path.tagline, { focusable: false })}</p>
      <div className="mt-4 flex flex-wrap gap-1">
        {path.modules.map((m, i) => (
          <Tag key={m.id} mono>
            {i + 1}. {m.title}
          </Tag>
        ))}
      </div>
    </Link>
  );
}
