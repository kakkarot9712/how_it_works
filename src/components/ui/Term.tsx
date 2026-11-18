"use client";

import { GLOSSARY, glossaryKey } from "@/lib/glossary";
import { Tooltip } from "./Tooltip";

/**
 * An acronym or code with the glossary's explanation in a `Tooltip` (dotted underline).
 * Use `focusable={false}` inside buttons (a focusable element can't nest in another).
 * Usually you don't use this directly: pass text through `gloss()` / `<Glossed>`.
 */
export function Term({ term, children, focusable = true }: { term: string; children?: string; focusable?: boolean }) {
  const key = glossaryKey(term);
  const entry = key && GLOSSARY[key];
  if (!entry) return <>{children ?? term}</>;
  return (
    <Tooltip
      as="abbr"
      focusable={focusable}
      heading={
        <>
          <span className={/^[a-z]/.test(key) ? "font-semibold" : "font-mono font-semibold"}>{key}</span>
          {entry.expansion && <> · {entry.expansion}</>}
        </>
      }
      tip={entry.brief}
      className="underline decoration-fg-muted/70 decoration-dotted underline-offset-[3px]"
    >
      {children ?? term}
    </Tooltip>
  );
}
