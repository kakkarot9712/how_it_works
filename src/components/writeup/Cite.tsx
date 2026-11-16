import { refNumber, type SourceSet } from "@/lib/sources";

/** An inline citation, Wikipedia style: superscript [n] links that jump to the References list. */
export function Cite({ ids, sources }: { ids: string[]; sources: SourceSet }) {
  return (
    <sup className="not-prose ml-0.5 whitespace-nowrap text-xs leading-none">
      {ids.map((id) => {
        const n = refNumber(sources, id);
        const ref = sources.references[n - 1];
        return (
          <a key={id} href={`#ref-${id}`} title={`${ref.title} (${ref.publisher})`} className="text-accent no-underline hover:underline">
            [{n}]
          </a>
        );
      })}
    </sup>
  );
}

/**
 * Bind a sim's sources once at the top of its Explainer: `const cite = citer(sources)`,
 * then write `{cite("xadd")}` after the sentence it supports. Unknown ids throw.
 */
export function citer(sources: SourceSet) {
  // Ids are checked on every call, so a typo fails the build when the page prerenders.
  return function cite(...ids: string[]) {
    ids.forEach((id) => refNumber(sources, id));
    return <Cite ids={ids} sources={sources} />;
  };
}
