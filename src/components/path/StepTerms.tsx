import Link from "next/link";
import { conceptsTaught } from "@/lib/glossary";
import type { SourceSet } from "@/lib/sources";
import { TermList } from "./TermList";
import { Eyebrow, Surface } from "@/components/ui";

/** Above this many terms the box shows only their names, and the definitions on demand. */
const OPEN_MAX = 8;

/**
 * "New words in this step": the concept terms this step uses that no earlier step of the
 * path did (each term's `taught.step`, enforced by paths.test.ts), with their briefs. Shown
 * at the top of a step so a reader meets the vocabulary before the text uses it. A long list
 * (a path's first step) is folded to the names, with every definition one click away and on
 * hover in the text. Renders nothing when the step adds no new terms.
 */
export function StepTerms({ path, step, pool }: { path: string; step: string; pool: SourceSet }) {
  const terms = conceptsTaught(path, step);
  if (!terms.length) return null;
  return (
    <Surface className="not-prose mb-10 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow>New words in this step</Eyebrow>
        <Link href={`/learn/${path}/terms`} className="text-xs text-fg-muted hover:text-fg">
          All terms of this path →
        </Link>
      </div>
      {terms.length <= OPEN_MAX ? (
        <div className="mt-3">
          <TermList terms={terms} pool={pool} />
        </div>
      ) : (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none text-note leading-relaxed text-fg-muted">
            <span className="text-fg">{terms.map((t) => t.key).join(", ")}</span>
            <span className="ml-2 text-accent group-open:hidden">Show all {terms.length} definitions ▾</span>
            <span className="ml-2 hidden text-accent group-open:inline">Hide definitions ▴</span>
          </summary>
          <div className="mt-4">
            <TermList terms={terms} pool={pool} />
          </div>
        </details>
      )}
    </Surface>
  );
}
