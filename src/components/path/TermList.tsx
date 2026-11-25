import type { TaughtTerm } from "@/lib/glossary";
import type { SourceSet } from "@/lib/sources";
import { getPath } from "@/paths/catalog";

/**
 * Concept terms as a definition list: the brief, what the term means in this system, the
 * other paths that share it, and "Read more" links to the official references behind it
 * (`taught.ref` and `taught.more`), so a reader can go to the full facts. Used by the
 * "New words in this step" box and the path's Terms page.
 */
export function TermList({ terms, pool }: { terms: TaughtTerm[]; pool: SourceSet }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {terms.map((t) => {
        const refs = [t.taught.ref, ...(t.taught.more ?? [])].flatMap((id) => pool.references.filter((r) => r.id === id));
        return (
          <div key={t.key} id={`term-${t.key.replace(/\s+/g, "-")}`} className="scroll-mt-20">
            <dt className="text-sm font-semibold text-fg">
              {t.key}
              {t.alsoIn.length > 0 && (
                <span className="ml-2 text-2xs font-normal text-accent">also in {t.alsoIn.map((p) => getPath(p)?.name ?? p).join(", ")}</span>
              )}
            </dt>
            <dd className="mt-0.5 text-note leading-snug text-fg-muted">
              {t.entry.brief}
              {t.taught.note && <span className="mt-0.5 block text-fg">{t.taught.note}</span>}
              {refs.map((r) => (
                <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="mt-1 block text-2xs text-accent hover:underline">
                  Read more: {r.title.replace(/ \(.*$/, "").replace(/, tag v[\d.]+$/, "")} ↗
                </a>
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
