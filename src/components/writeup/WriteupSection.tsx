import type { ReactNode } from "react";

/** A top-level section of the write-up. `id` must match an entry in the writeup's `sections`. */
export function WriteupSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line pt-10 first:border-t-0 first:pt-0">
      <h2 className="group">
        {title}
        <a href={`#${id}`} aria-label={`Link to ${title}`} className="ml-2 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100">
          #
        </a>
      </h2>
      {children}
    </section>
  );
}
