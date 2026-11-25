"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PathStep } from "@/paths/catalog";
import { Button, Eyebrow, Heading, surfaceClass } from "@/components/ui";
import { useProgress } from "./useProgress";

/**
 * End of a step: one way forward. The next-step card marks this step done and moves on
 * (on the last step it finishes the path); the previous-step card just goes back.
 */
export function StepFooter({ path, step, prev, next }: { path: string; step: string; prev?: PathStep; next?: PathStep }) {
  const router = useRouter();
  const { done, setDone } = useProgress(path);
  const finished = done.has(step);
  const base = `/learn/${path}`;
  const forward = () => {
    setDone(step);
    router.push(next ? `${base}/${next.slug}` : base);
  };

  return (
    <footer className="mt-14 border-t border-line pt-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link href={`${base}/${prev.slug}`} className={surfaceClass({ radius: "xl", interactive: true }, "block px-5 py-4")}>
            <Eyebrow size="sm">‹ Previous</Eyebrow>
            <Heading level="item" as="span" className="mt-1 block">
              {prev.title}
            </Heading>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
        <button type="button" onClick={forward} className={surfaceClass({ radius: "xl", tone: "accent", interactive: true }, "block px-5 py-4 text-left sm:text-right")}>
          <Eyebrow size="sm" tone="accent">
            {next ? "✓ Done · next ›" : "✓ Done · finish the path"}
          </Eyebrow>
          <Heading level="item" as="span" className="mt-1 block">
            {next ? next.title : "Back to the path overview"}
          </Heading>
        </button>
      </div>
      {finished && (
        <div className="mt-3 flex items-center justify-end gap-2 text-note text-fg-muted">
          <span className="text-ok">✓ You finished this step.</span>
          <Button tone="ghost" onClick={() => setDone(step, false)}>
            Mark as not done
          </Button>
        </div>
      )}
    </footer>
  );
}
