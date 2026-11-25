import { cloneElement, Fragment, isValidElement, type ReactNode } from "react";
import { ACRONYM_RE, GLOSSARY_RE, glossaryKey } from "@/lib/glossary";
import { Term } from "./Term";

/** Elements whose text is left alone: code is literal, and links/buttons can't hold a focusable term. */
const SKIP = new Set(["code", "pre", "a", "abbr", "button", "svg", "kbd"]);

export interface GlossOptions {
  /** Shared across a page to mark only the first use of each term (long prose). Omit to mark every use. */
  seen?: Set<string>;
  /** False inside clickable rows (e.g. narration entries are buttons). */
  focusable?: boolean;
  /**
   * Also mark concept terms (taint, partition, controller…), not just acronyms. On by default
   * when `seen` is given (first use only); text marked on every use (narration, inspector
   * help, labels) gets acronyms only, so common words don't fill it with underlines.
   */
  concepts?: boolean;
}

/**
 * Wraps glossary terms found in text with <Term> tooltips: acronyms (TCP, FIN, OOM…) always,
 * concept terms (taint, partition…) in first-use mode (see `concepts`).
 * Works on strings and on element trees (recurses into children, skipping code,
 * links and buttons). Server-safe.
 */
export function gloss(node: ReactNode, opts: GlossOptions = {}): ReactNode {
  if (typeof node === "string") return glossText(node, opts);
  if (Array.isArray(node)) return node.map((n, i) => <Fragment key={i}>{gloss(n, opts)}</Fragment>);
  if (isValidElement<{ children?: ReactNode }>(node)) {
    if ((typeof node.type === "string" && SKIP.has(node.type)) || node.type === Term) return node;
    if (node.props.children === undefined) return node;
    return cloneElement(node, undefined, gloss(node.props.children, opts));
  }
  return node;
}

function glossText(text: string, { seen, focusable = true, concepts = seen !== undefined }: GlossOptions): ReactNode {
  const parts = text.split(concepts ? GLOSSARY_RE : ACRONYM_RE);
  if (parts.length === 1) return text;
  // split() with a capture group puts matches at odd indices.
  return parts.map((p, i) => {
    if (i % 2 === 0) return p;
    const key = glossaryKey(p) ?? p; // "High watermark" and "high watermark" are one term for `seen`
    if (seen?.has(key)) return p;
    seen?.add(key);
    return <Term key={i} term={p} focusable={focusable} />;
  });
}

/** `gloss()` as a wrapper: <Glossed>…text and elements…</Glossed>. */
export function Glossed({ children, once, focusable }: { children: ReactNode; once?: boolean; focusable?: boolean }) {
  return <>{gloss(children, { seen: once ? new Set() : undefined, focusable })}</>;
}
