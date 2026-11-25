import { Heading } from "@/components/ui";
import type { SourceSet } from "@/lib/sources";

/**
 * The end-of-page "References" section: version modelled, then the numbered sources cited above.
 * `scope="page"` for pages that are not a simulator's write-up (a learning-path step).
 */
export function References({ id = "references", title, sources, scope = "simulator" }: { id?: string; title: string; sources: SourceSet; scope?: "simulator" | "page" }) {
  return (
    <section id={id} className="mt-12 scroll-mt-20 border-t border-line pt-10">
      <Heading level="section">{title}</Heading>
      <p className="mt-3 text-base leading-prose text-fg-muted">
        {scope === "page" ? "Written for" : "Modelled on"} <strong className="text-fg">{sources.subject} {sources.version}</strong>. {sources.versionNote}{" "}
        Sources last checked {sources.checked}.{" "}
        {scope === "page"
          ? "Every claim on this page comes from the sources below; anything the page simplifies is listed in its \u201csimplifies\u201d box."
          : "Every claim on this page and in the simulator comes from the sources below; anything the simulation simplifies is listed under \u201cWhat this simulation simplifies\u201d."}
      </p>
      <ol className="mt-6 space-y-1 text-note leading-snug text-fg-muted">
        {sources.references.map((r, i) => (
          // The clicked citation's target (#ref-id) is highlighted via :target, so shared links highlight too.
          <li
            key={r.id}
            id={`ref-${r.id}`}
            className="group -mx-2 flex scroll-mt-24 gap-3 rounded-md border-l-2 border-transparent px-2 py-1 transition-colors target:border-accent target:bg-accent/10 target:text-fg"
          >
            <span className="w-8 shrink-0 text-right font-mono text-fg group-target:text-accent">[{i + 1}]</span>
            <span className="min-w-0">
              <a href={r.url} className="text-fg underline decoration-line underline-offset-2 hover:decoration-fg" target="_blank" rel="noopener noreferrer">
                {r.title}
              </a>
              . {r.publisher}. Accessed {r.accessed}.
              {r.approval && (
                <span className="text-warn">
                  {" "}
                  Non-official source, approved by the owner on {r.approval.date}: {r.approval.reason}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      {sources.relaxed?.length ? (
        <ul className="mt-6 space-y-1 text-note text-warn">
          {sources.relaxed.map((x) => (
            <li key={x.rule}>
              Owner-approved exception ({x.rule}, {x.date}): {x.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
