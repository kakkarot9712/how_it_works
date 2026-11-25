/**
 * Enforces the `source-facts` skill: every module says which version it models and
 * where each fact comes from, Wikipedia style. A failure here means a claim (or a
 * term shown to users) has no reliable source. Fix it by finding the source in the
 * official docs, or by removing the claim. Only the owner can relax a rule, per module,
 * via `relaxed` in that module's sources.ts.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allTopics } from "@/catalog";
import type { SourceRule, SourceSet } from "@/lib/sources";
import { files, termsIn } from "@/lib/source-terms";
import { writeups } from "./explainers";

const SIMS = join(process.cwd(), "src/sims");
const dirs = readdirSync(SIMS).filter((d) => statSync(join(SIMS, d)).isDirectory() && statSync(join(SIMS, d, "model.ts"), { throwIfNoEntry: false }));

const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe("sources: every module cites reliable sources for what it says", () => {
  it("every live sim has a write-up with a source set", () => {
    for (const t of allTopics)
      for (const s of t.sims.filter((x) => x.status === "live")) {
        const w = writeups[`${t.slug}/${s.slug}`];
        expect(w?.sources, `${t.slug}/${s.slug}: add sources.ts and pass it to writeups[]`).toBeTruthy();
      }
  });

  for (const dir of dirs) {
    describe(dir, async () => {
      const { sources } = (await import(`./${dir}/sources`)) as { sources: SourceSet };
      const relaxed = (rule: SourceRule) => sources.relaxed?.some((r) => r.rule === rule && r.approvedBy === "owner" && ISO.test(r.date) && r.reason.length > 10);
      const explainer = readFileSync(join(SIMS, dir, "writeup/Explainer.tsx"), "utf8");
      const entry = Object.entries(writeups).find(([, w]) => w.sources === sources);
      const cited = [...explainer.matchAll(/cite\(([^)]*)\)/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));

      it("declares the version it models", () => {
        expect(sources.subject.length).toBeGreaterThan(2);
        expect(sources.version).toMatch(/\d/);
        expect(sources.label).toContain(sources.version);
        expect(sources.checked).toMatch(ISO);
        expect(entry, "registered in writeups with this same sources object").toBeTruthy();
      });

      it("the simulator shows the same version (index.ts passes sources)", () => {
        expect(readFileSync(join(SIMS, dir, "index.ts"), "utf8")).toMatch(/\bsources\b/);
      });

      it("references are well formed and unique", () => {
        const ids = sources.references.map((r) => r.id);
        expect(new Set(ids).size, "duplicate reference id").toBe(ids.length);
        for (const r of sources.references) {
          expect(r.url, r.id).toMatch(/^https:\/\//);
          expect(r.accessed, r.id).toMatch(ISO);
          expect(r.title.length, r.id).toBeGreaterThan(2);
        }
      });

      it("references come from official sources, or the owner approved them", () => {
        if (relaxed("official-domains")) return;
        for (const r of sources.references) {
          const official = sources.officialSources.some((p) => r.url.startsWith(p));
          const approved = r.approval?.approvedBy === "owner" && ISO.test(r.approval.date) && r.approval.reason.length > 10;
          expect(official || approved, `${r.id}: ${r.url} is not under officialSources and has no owner approval. Find it in the official docs, or ask the owner.`).toBe(true);
        }
      });

      it("every citation resolves and every reference is cited (no orphans)", () => {
        const ids = new Set(sources.references.map((r) => r.id));
        for (const c of cited) expect(ids.has(c), `cite("${c}") has no reference`).toBe(true);
        for (const id of ids) expect(cited, `reference "${id}" is never cited`).toContain(id);
      });

      it("references are numbered in order of first citation, like Wikipedia", () => {
        const firstUse = [...new Set(cited)];
        expect(sources.references.map((r) => r.id)).toEqual(firstUse);
      });

      it("every write-up section cites at least one source (except 'What this simulation simplifies')", () => {
        if (relaxed("section-citations")) return;
        const sections = explainer.split(/<WriteupSection id="/).slice(1);
        expect(sections.length).toBeGreaterThan(0);
        for (const s of sections) {
          const id = s.slice(0, s.indexOf('"'));
          if (id === "simplifies") continue;
          expect(/cite\(/.test(s), `section "${id}" has no citation`).toBe(true);
        }
      });

      it("every command, option, code and config name shown to users is covered by a reference", () => {
        if (relaxed("coverage")) return;
        const covered = new Set(sources.references.flatMap((r) => r.covers));
        const texts = files(join(SIMS, dir)).map((f) => readFileSync(f, "utf8"));
        const [topic, slug] = entry![0].split("/");
        texts.push(JSON.stringify(allTopics.find((t) => t.slug === topic)?.sims.find((x) => x.slug === slug)?.summary ?? ""));
        const missing = [...new Set(texts.flatMap((t) => [...termsIn(t)]))].filter((t) => !covered.has(t)).sort();
        expect(missing, "add the source that documents these to a reference's `covers` (after reading it), or remove them from the text").toEqual([]);
      });
    });
  }
});
