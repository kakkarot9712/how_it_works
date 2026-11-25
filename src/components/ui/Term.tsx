"use client";

import { GLOSSARY, glossaryKey } from "@/lib/glossary";
import { getStep } from "@/paths/catalog";
import { Tooltip } from "./Tooltip";

/**
 * A glossary term with its explanation in a `Tooltip` (dotted underline): an acronym
 * (expansion + brief) or a concept term (brief, then one line per learning path that uses
 * it: what it means there and the step that teaches it, so a reader sees the same idea
 * across systems). Use `focusable={false}` inside buttons (a focusable element can't nest
 * in another). Usually you don't use this directly: pass text through `gloss()` / `<Glossed>`.
 */
export function Term({ term, children, focusable = true }: { term: string; children?: string; focusable?: boolean }) {
  const key = glossaryKey(term);
  const entry = key && GLOSSARY[key];
  if (!entry) return <>{children ?? term}</>;
  const uses = (entry.taught ?? []).flatMap((t) => {
    const found = getStep(t.path, t.step);
    return found ? [{ ...t, pathName: found.path.name, stepTitle: found.step.title }] : [];
  });
  return (
    <Tooltip
      as="abbr"
      focusable={focusable}
      heading={
        <>
          <span className={/^[a-z]/.test(key) || entry.taught ? "font-semibold" : "font-mono font-semibold"}>{key}</span>
          {entry.expansion && <> · {entry.expansion}</>}
        </>
      }
      tip={
        <>
          {entry.brief}
          {uses.map((u) => (
            <span key={u.path} className="mt-1.5 block border-t border-line pt-1.5">
              <span className="font-semibold text-fg">{u.pathName}</span>
              {u.note && <>: {u.note}</>}
              <span className="block text-2xs text-fg-muted">Taught in “{u.stepTitle}”</span>
            </span>
          ))}
        </>
      }
      className="underline decoration-fg-muted/70 decoration-dotted underline-offset-[3px]"
    >
      {children ?? term}
    </Tooltip>
  );
}
