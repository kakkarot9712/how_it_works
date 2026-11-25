import type { ReactNode } from "react";
import type { Reference, SourceSet } from "@/lib/sources";
import { Eyebrow, Surface } from "@/components/ui";

/**
 * "Simplified here": a warn-toned box placed exactly where a page takes a shortcut (inside the
 * trace hop, under the widget, next to the paragraph), saying what is simplified and linking to
 * the official pages with the real behaviour. It replaces an end-of-page "What this simplifies"
 * list, where readers lost track of which part each item was about. Build it with `simplifier`.
 */
export function Simplified({ refs, children }: { refs: Reference[]; children: ReactNode }) {
  return (
    <Surface as="aside" tone="warn" className="not-prose my-4 px-4 py-3">
      <Eyebrow tone="warn" size="sm">
        Simplified here
      </Eyebrow>
      <div className="mt-1 text-note leading-relaxed text-fg [&_code]:rounded [&_code]:bg-panel-2 [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs">
        {children}
      </div>
      {refs.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs">
          <span className="text-fg-muted">The real behaviour:</span>
          {refs.map((r) => (
            <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="text-warn hover:underline">
              {r.title.replace(/ \(.*$/, "").replace(/, tag v[\d.]+$/, "")} ↗
            </a>
          ))}
        </p>
      )}
    </Surface>
  );
}

/**
 * `const simplified = simplifier(sources)`, then `simplified(["producer-configs"], <>One record. Real producers batch…</>)`
 * where the shortcut is. The ids must be in the page's `sources` (a typo fails the prerender) and
 * count as citations in first-use order (src/paths/paths.test.ts).
 */
export function simplifier(sources: SourceSet) {
  return function simplified(ids: string[], body: ReactNode) {
    const refs = ids.map((id) => {
      const r = sources.references.find((x) => x.id === id);
      if (!r) throw new Error(`simplified(): unknown reference "${id}"`);
      return r;
    });
    return <Simplified refs={refs}>{body}</Simplified>;
  };
}
