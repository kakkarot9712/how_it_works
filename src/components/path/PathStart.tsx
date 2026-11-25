"use client";

import { stepsOf, type LearningPath } from "@/paths/catalog";
import { Button, LinkButton } from "@/components/ui";
import { useProgress } from "./useProgress";

/** The path's call to action: start, continue at the first unfinished step, or review. Plus progress and a reset. */
export function PathStart({ path }: { path: LearningPath }) {
  const { done, reset } = useProgress(path.slug);
  const all = stepsOf(path);
  const count = all.filter((s) => done.has(s.step.slug)).length;
  const nextUp = all.find((s) => !done.has(s.step.slug))?.step;
  const href = `/learn/${path.slug}/${(nextUp ?? all[0].step).slug}`;
  const label = count === 0 ? "▶ Start the path" : nextUp ? `▶ Continue: ${nextUp.title}` : "▶ Review from the start";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <LinkButton href={href} size="lg">
        {label}
      </LinkButton>
      <span className="font-mono text-xs text-fg-muted">
        {count}/{all.length} steps done
      </span>
      {count > 0 && (
        <Button tone="ghost" onClick={reset}>
          Reset progress
        </Button>
      )}
    </div>
  );
}
