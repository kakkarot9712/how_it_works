import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { gloss } from "@/components/ui/gloss";
import { Term } from "@/components/ui/Term";
import { GLOSSARY, GLOSSARY_RE } from "./glossary";

/** Terms gloss() wrapped, in order, anywhere in the tree. */
function terms(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(terms);
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<{ term?: string; children?: ReactNode }>;
  if (el.type === Term) return [el.props.term!];
  return terms(el.props.children);
}

describe("glossary", () => {
  it("every entry has a short, non-empty brief", () => {
    for (const [term, g] of Object.entries(GLOSSARY)) {
      expect(g.brief.length, term).toBeGreaterThan(20);
      expect(g.brief.length, term).toBeLessThan(220);
    }
  });

  it("matches whole words only, longest first", () => {
    expect("RESP2 vs RESP, TCP's window, FINE, GCP".match(GLOSSARY_RE)).toEqual(["RESP2", "RESP", "TCP"]);
  });

  it("wraps acronyms in text and nested elements, but not code", () => {
    const tree = createElement("p", null, "No FIN or RST arrives over ", createElement("strong", null, "TCP"), " ", createElement("code", null, "OOM"));
    expect(terms(gloss(tree))).toEqual(["FIN", "RST", "TCP"]);
  });

  it("with a shared `seen` set, marks only the first use", () => {
    const seen = new Set<string>();
    expect(terms(gloss("TCP and TCP", { seen }))).toEqual(["TCP"]);
    expect(terms(gloss("TCP again, then FIN", { seen }))).toEqual(["FIN"]);
  });
});
