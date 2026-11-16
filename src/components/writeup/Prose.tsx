import type { ReactNode } from "react";
import { gloss } from "@/components/ui";

/**
 * Typography for long-form write-ups. Layout (width, padding) belongs to the page.
 * Anything inside a `.not-prose` element (TryIt, Figure, AnnotatedConfig…) keeps its own styles.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <article
      className={[
        "space-y-12 text-base leading-prose text-fg-muted",
        "[&_h2:not(.not-prose_*)]:mb-4 [&_h2:not(.not-prose_*)]:text-2xl [&_h2:not(.not-prose_*)]:font-semibold [&_h2:not(.not-prose_*)]:tracking-tight [&_h2:not(.not-prose_*)]:text-fg",
        "[&_h3:not(.not-prose_*)]:mb-2 [&_h3:not(.not-prose_*)]:mt-8 [&_h3:not(.not-prose_*)]:text-lg [&_h3:not(.not-prose_*)]:font-semibold [&_h3:not(.not-prose_*)]:text-fg",
        "[&_p:not(.not-prose_*)]:my-3 [&_strong]:font-semibold [&_strong]:text-fg [&_em]:text-fg",
        "[&_ul:not(.not-prose_*)]:my-3 [&_ul:not(.not-prose_*)]:list-disc [&_ul:not(.not-prose_*)]:space-y-1.5 [&_ul:not(.not-prose_*)]:pl-5 [&_li:not(.not-prose_*)]:marker:text-fg-muted/60",
        "[&_code:not(.not-prose_*)]:rounded [&_code:not(.not-prose_*)]:bg-panel-2 [&_code:not(.not-prose_*)]:px-1 [&_code:not(.not-prose_*)]:py-0.5 [&_code:not(.not-prose_*)]:font-mono [&_code:not(.not-prose_*)]:text-sm [&_code:not(.not-prose_*)]:text-fg",
        "[&_a:not(.not-prose_*)]:text-fg [&_a:not(.not-prose_*)]:underline [&_a:not(.not-prose_*)]:decoration-line [&_a:not(.not-prose_*)]:underline-offset-4 [&_a:not(.not-prose_*):hover]:decoration-accent",
        "[&_h2_a]:no-underline",
      ].join(" ")}
    >
      {/* First use of each acronym on the page gets a tooltip; later uses stay plain. */}
      {gloss(children, { seen: new Set() })}
    </article>
  );
}
