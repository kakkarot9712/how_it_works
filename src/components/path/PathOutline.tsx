"use client";

import Link from "next/link";
import type { LearningPath } from "@/paths/catalog";
import { cx } from "@/lib/cx";
import { Eyebrow } from "@/components/ui";
import { useProgress } from "./useProgress";

/** The path's modules and steps as a compact rail beside a step: current step marked, finished ones ticked. */
export function PathOutline({ path, current }: { path: LearningPath; current: string }) {
  const { done } = useProgress(path.slug);
  let n = 0;
  return (
    <nav aria-label={`${path.name} path`} className="space-y-5 text-sm">
      {path.modules.map((m, mi) => (
        <div key={m.id}>
          <Eyebrow className="mb-2">
            {mi + 1}. {m.title}
          </Eyebrow>
          <ul className="space-y-0.5 border-l border-line">
            {m.steps.map((s) => {
              n++;
              const on = s.slug === current;
              const finished = done.has(s.slug);
              return (
                <li key={s.slug}>
                  <Link
                    href={`/learn/${path.slug}/${s.slug}`}
                    aria-current={on ? "step" : undefined}
                    className={cx(
                      "-ml-px flex items-baseline gap-2 border-l-2 py-1 pl-3 leading-snug transition-colors",
                      on ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg",
                    )}
                  >
                    <span className={cx("w-4 shrink-0 font-mono text-xs", finished ? "text-ok" : "text-fg-muted")}>{finished ? "✓" : n}</span>
                    <span>{s.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
