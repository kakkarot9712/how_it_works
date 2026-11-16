import type { ReactNode } from "react";
import { Surface } from "@/components/ui";

/** A figure with a caption. The child (usually an SVG) scrolls sideways on narrow screens. */
export function Figure({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  return (
    <figure className="not-prose my-8">
      <Surface className="overflow-x-auto p-4">{children}</Surface>
      <figcaption className="mt-3 text-sm leading-relaxed text-fg-muted">{caption}</figcaption>
    </figure>
  );
}
