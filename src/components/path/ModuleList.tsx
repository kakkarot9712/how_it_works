"use client";

import Link from "next/link";
import type { LearningPath } from "@/paths/catalog";
import { cx } from "@/lib/cx";
import { gloss, Heading, Pill, surfaceClass } from "@/components/ui";
import { StepKindTag } from "./StepKindTag";
import { useProgress } from "./useProgress";

/** A path's modules, each with its steps as numbered rows (format, time, done). The path home's main list. */
export function ModuleList({ path }: { path: LearningPath }) {
  const { done } = useProgress(path.slug);
  let n = 0;
  return (
    <ol className="space-y-10">
      {path.modules.map((m, mi) => (
        <li key={m.id} id={`module-${m.id}`} className="scroll-mt-20">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-sm text-accent">{String(mi + 1).padStart(2, "0")}</span>
            <div>
              <Heading level="card" as="h3">
                {m.title}
              </Heading>
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">{gloss(m.summary)}</p>
            </div>
          </div>
          <ol className="mt-4 space-y-2">
            {m.steps.map((s) => {
              n++;
              const finished = done.has(s.slug);
              return (
                <li key={s.slug}>
                  <Link href={`/learn/${path.slug}/${s.slug}`} className={surfaceClass({ radius: "xl", interactive: true }, "flex items-start gap-4 px-5 py-4")}>
                    <span className={cx("mt-0.5 w-5 shrink-0 font-mono text-sm", finished ? "text-ok" : "text-fg-muted")} aria-label={finished ? "done" : undefined}>
                      {finished ? "✓" : n}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Heading level="item" as="span">
                          {s.title}
                        </Heading>
                        <StepKindTag kind={s.kind} focusable={false} />
                        {finished && (
                          <Pill size="sm" tone="ok">
                            done
                          </Pill>
                        )}
                      </span>
                      <span className="mt-1 block text-note leading-relaxed text-fg-muted">{gloss(s.summary, { focusable: false })}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-fg-muted">{s.minutes} min</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
