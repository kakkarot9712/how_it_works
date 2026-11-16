import { Fragment } from "react";
import { gloss } from "@/components/ui";

/** Renders `code` and **bold** inside short write-up strings, with glossary tooltips on acronyms. Pass `seen` to mark only first uses. */
export function Rich({ text, seen }: { text: string; seen?: Set<string> }) {
  return (
    <>
      {text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith("`") ? (
          <code key={i} className="rounded bg-panel-2 px-1 py-0.5 font-mono text-[0.88em] text-fg">
            {part.slice(1, -1)}
          </code>
        ) : part.startsWith("**") ? (
          <strong key={i} className="font-semibold text-fg">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{gloss(part, { seen })}</Fragment>
        ),
      )}
    </>
  );
}
