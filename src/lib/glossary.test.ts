import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { gloss } from "@/components/ui/gloss";
import { Term } from "@/components/ui/Term";
import { GLOSSARY, GLOSSARY_RE, glossaryTitles } from "./glossary";

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

  it("matches plurals (PELs, ACKs) but not longer words", () => {
    expect(terms(gloss("their PELs and ACKs, not PELICAN"))).toEqual(["PEL", "ACK"]);
  });

  it("matches phrases, also capitalized at a sentence start, as one term", () => {
    expect(terms(gloss("High watermarks and the high watermark, not highwatermark", { concepts: true }))).toEqual(["High watermark", "high watermark"]);
    const seen = new Set<string>();
    expect(terms(gloss("High watermark. Then the high watermark again.", { seen }))).toEqual(["High watermark"]);
    expect(glossaryTitles("High watermark stuck at 4")).toMatch(/^high watermark: Kafka's commit point/);
  });

  it("builds SVG tooltip text for every term in a label", () => {
    expect(glossaryTitles("pending (PEL) over TCP")).toContain("PEL (Pending Entries List)");
    expect(glossaryTitles("pending (PEL) over TCP")).toContain("TCP (Transmission Control Protocol)");
    expect(glossaryTitles("no acronyms here")).toBeUndefined();
  });

  it("wraps acronyms in text and nested elements, but not code", () => {
    const tree = createElement("p", null, "No FIN or RST arrives over ", createElement("strong", null, "TCP"), " ", createElement("code", null, "OOM"));
    expect(terms(gloss(tree))).toEqual(["FIN", "RST", "TCP"]);
  });

  it("marks concept terms only in first-use mode, and not inside hyphenated names", () => {
    expect(terms(gloss("the leader of node-1 and kube-proxy"))).toEqual([]);
    expect(terms(gloss("the leader of node-1 and a node", { seen: new Set() }))).toEqual(["leader", "node"]);
    expect(terms(gloss("Rebalancing the group", { seen: new Set() }))).toEqual(["Rebalancing"]);
  });

  it("with a shared `seen` set, marks only the first use", () => {
    const seen = new Set<string>();
    expect(terms(gloss("TCP and TCP", { seen }))).toEqual(["TCP"]);
    expect(terms(gloss("TCP again, then FIN", { seen }))).toEqual(["FIN"]);
  });
});
