/**
 * Learning paths follow the same rules as the sims (source-facts skill), per step:
 * every claim is cited from an official source, numbered by first use on the page,
 * and every command or config name shown is covered by a reference. On top of that,
 * labs must open real scenarios at real moments, traces must be well formed, and the
 * system map must link to real steps.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allTopics } from "@/catalog";
import { traceStateAt } from "@/components/path";
import { GLOSSARY, GLOSSARY_RE, glossaryKey, isConcept } from "@/lib/glossary";
import { readableText, termsIn } from "@/lib/source-terms";
import { DEFAULT_DURATION_MS } from "@/sims/types";
import { allPaths, getStep, stepsOf } from "./catalog";
import { pathContent } from "./content";

const ROOT = join(process.cwd(), "src/paths");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Reference ids a step uses, in file order: cite("a", "b") and simplified(["c"], …) both count. */
const citedIn = (src: string) =>
  [...src.matchAll(/cite\(([^)]*)\)|simplified\(\s*\[([^\]]*)\]/g)].flatMap((m) => [...(m[1] ?? m[2]).matchAll(/"([^"]+)"/g)].map((x) => x[1]));

/** A sim's scenarios, by `topic/sim` id, read from the sim's own module. */
async function scenariosOf(sim: string): Promise<{ id: string; duration?: number }[]> {
  const dir = { "kafka/produce-and-replicate": "kafka-replication", "kafka/consumer-groups": "kafka-consumer-groups" }[sim];
  expect(dir, `${sim}: map it to its folder in paths.test.ts`).toBeTruthy();
  return (await import(`../sims/${dir}/scenarios.ts`)).scenarios;
}

describe("paths: catalog and content agree", () => {
  for (const path of allPaths) {
    it(`${path.slug}: every step has content, every content entry is a step`, () => {
      const content = pathContent[path.slug];
      expect(content, `register ${path.slug} in src/paths/content.tsx`).toBeTruthy();
      const slugs = stepsOf(path).map((s) => s.step.slug);
      expect(new Set(slugs).size, "duplicate step slug").toBe(slugs.length);
      expect(Object.keys(content.steps).sort()).toEqual([...slugs].sort());
    });

    it(`${path.slug}: links to a real topic, and labs to live sims`, () => {
      const topic = allTopics.find((t) => t.slug === path.topic);
      expect(topic, `topic ${path.topic}`).toBeTruthy();
      for (const { step } of stepsOf(path)) {
        if (step.kind !== "lab") continue;
        const [t, s] = step.sim?.split("/") ?? [];
        expect(allTopics.find((x) => x.slug === t)?.sims.find((x) => x.slug === s)?.status, `${step.slug}: sim ${step.sim}`).toBe("live");
        expect(pathContent[path.slug].steps[step.slug].simHref).toBe(`/${step.sim}`);
      }
    });

    it(`${path.slug}: every system-map box opens a real step`, () => {
      for (const n of pathContent[path.slug].map.nodes) expect(getStep(path.slug, n.step) ?? (path.hidden ? true : undefined), `map node ${n.id} → ${n.step}`).toBeTruthy();
    });

    it(`${path.slug}: says who talks to whom, and every connection opens a real step`, () => {
      const conns = pathContent[path.slug].map.connections ?? [];
      expect(conns.length, "add map.connections: every link in the system, from the side that opens it (add-path-step skill)").toBeGreaterThan(0);
      for (const c of conns) {
        for (const f of ["from", "to", "call", "pattern", "control"] as const) expect(c[f].trim(), `${c.from} → ${c.to}: ${f}`).not.toBe("");
        expect(getStep(path.slug, c.step) ?? (path.hidden ? true : undefined), `connection ${c.from} → ${c.to} → step ${c.step}`).toBeTruthy();
      }
    });
  }
});

describe("paths: every step cites reliable sources, Wikipedia style", () => {
  for (const path of allPaths) {
    const { pool } = pathContent[path.slug];

    it(`${path.slug}: the pool declares a version and official references`, () => {
      expect(pool.version).toMatch(/\d/);
      expect(pool.label).toContain(pool.version);
      expect(pool.checked).toMatch(ISO);
      const ids = pool.references.map((r) => r.id);
      expect(new Set(ids).size, "duplicate reference id").toBe(ids.length);
      for (const r of pool.references) {
        expect(r.accessed, r.id).toMatch(ISO);
        const official = pool.officialSources.some((p) => r.url.startsWith(p));
        const approved = r.approval?.approvedBy === "owner" && ISO.test(r.approval.date);
        expect(official || approved, `${r.id}: ${r.url} is not official and has no owner approval`).toBe(true);
      }
    });

    for (const { step } of stepsOf(path)) {
      describe(`${path.slug}/${step.slug}`, () => {
        const content = pathContent[path.slug].steps[step.slug];
        const file = join(ROOT, path.slug, "steps", `${step.slug}.tsx`);
        const src = readFileSync(file, "utf8");
        const cited = citedIn(src);

        it("cites at least one source", () => expect(cited.length).toBeGreaterThan(0));

        it("references are its own citations, numbered by first use", () => {
          expect(content.sources.references.map((r) => r.id)).toEqual([...new Set(cited)]);
        });

        it("every section except a 'simplifies' box cites a source", () => {
          for (const s of src.split(/<WriteupSection id="/).slice(1)) expect(/cite\(/.test(s), `section "${s.slice(0, s.indexOf('"'))}" has no citation`).toBe(true);
        });

        it("every command, option, code and config name shown is covered by a reference", () => {
          const covered = new Set(content.sources.references.flatMap((r) => r.covers));
          const texts = [src, JSON.stringify(step.summary)];
          if (step.slug === stepsOf(path)[0].step.slug) texts.push(JSON.stringify([path.lede, path.tagline, path.modules.map((m) => m.summary)]));
          const missing = [...new Set(texts.flatMap((t) => [...termsIn(t)]))].filter((t) => !covered.has(t)).sort();
          expect(missing, "cite a source that documents these on this step (add to its `covers`), or remove them").toEqual([]);
        });

        if (step.kind === "trace")
          it("the trace is well formed", () => {
            const spec = content.trace!;
            expect(spec, "export `trace` from the step").toBeTruthy();
            const actors = new Set(spec.actors.map((a) => a.id));
            for (const f of spec.state?.fields ?? []) expect(f.short.length, `field ${f.id}: short label must fit the actor box`).toBeLessThanOrEqual(12);
            spec.hops.forEach((h, i) => {
              expect(actors.has(h.from) && actors.has(h.to), `hop ${i + 1}: ${h.from} → ${h.to}`).toBe(true);
              for (const [a, fields] of Object.entries(h.set ?? {})) {
                expect(spec.state?.initial[a], `hop ${i + 1} sets state on ${a}, which has no initial state`).toBeTruthy();
                for (const f of Object.keys(fields)) expect(spec.state!.fields.some((x) => x.id === f), `hop ${i + 1}: unknown field ${f}`).toBe(true);
              }
            });
            expect(traceStateAt(spec, spec.hops.length - 1).state).toBeTruthy();
          });

        if (step.kind === "lab")
          it("every prediction opens a real scenario within its run, with exactly one right answer", async () => {
            const preds = content.predictions!;
            expect(preds?.length, "export `predictions` from the step").toBeGreaterThan(0);
            const scenarios = await scenariosOf(step.sim!);
            for (const p of preds) {
              const sc = scenarios.find((s) => s.id === p.scenario);
              expect(sc, `scenario ${p.scenario}`).toBeTruthy();
              expect(p.t).toBeGreaterThanOrEqual(0);
              expect(p.t, `${p.scenario}: t past the run`).toBeLessThanOrEqual(sc!.duration ?? DEFAULT_DURATION_MS);
              expect(p.options.filter((o) => o.correct).length, `${p.scenario}: one right answer`).toBe(1);
            }
          });
      });
    }
  }
});

/** Concept terms (src/lib/concepts.ts) a step's reader sees: its prose, trace and predictions, minus code and citations. */
function conceptsUsed(src: string): Set<string> {
  const text = readableText(src.replace(/<code[^>]*>[\s\S]*?<\/code>/g, " ").replace(/\{cite\([^)]*\)\}/g, " "));
  return new Set([...text.matchAll(GLOSSARY_RE)].map((m) => glossaryKey(m[1])!).filter(isConcept));
}

describe("paths: every term is defined where it is first used (define-terms skill)", () => {
  for (const path of allPaths) {
    const steps = stepsOf(path).map(({ step }) => step.slug);
    const firstUse = new Map<string, string>();
    for (const slug of steps) {
      const src = readFileSync(join(ROOT, path.slug, "steps", `${slug}.tsx`), "utf8");
      for (const key of conceptsUsed(src)) if (!firstUse.has(key)) firstUse.set(key, slug);
    }
    const taughtHere = Object.entries(GLOSSARY).flatMap(([key, g]) => (g.taught ?? []).filter((t) => t.path === path.slug).map((t) => ({ key, t })));

    it(`${path.slug}: each term it uses is taught in the step that first uses it`, () => {
      const wrong = [...firstUse].flatMap(([key, step]) => {
        const t = GLOSSARY[key].taught!.find((x) => x.path === path.slug);
        return t?.step === step ? [] : [`${key}: first used in "${step}", taught ${t ? `in "${t.step}"` : "nowhere for this path"}`];
      });
      expect(wrong, "set taught { path, step } in src/lib/concepts.ts (or glossary.ts) to the step of first use").toEqual([]);
    });

    it(`${path.slug}: no stale terms, and every term's references exist`, () => {
      const refs = new Set(pathContent[path.slug].pool.references.map((r) => r.id));
      for (const { key, t } of taughtHere) {
        expect(firstUse.has(key), `${key} is taught for ${path.slug} but no step uses it`).toBe(true);
        expect(steps, `${key}: unknown step ${t.step}`).toContain(t.step);
        for (const id of [t.ref, ...(t.more ?? [])]) expect(refs.has(id), `${key}: reference ${id} is not in the ${path.slug} pool`).toBe(true);
      }
    });
  }
});

/**
 * Page anatomy every step follows (path-standards skill). Traces and Explore steps end with
 * "What to take away" and "What if…"; a Lab's prediction cards are its what-if cases, and its
 * "Simplified here" box sits before them. Simplifications never go in an end-of-page list.
 */
describe("paths: every step follows the page anatomy (path-standards skill)", () => {
  for (const path of allPaths) {
    for (const { step } of stepsOf(path)) {
      const src = readFileSync(join(ROOT, path.slug, "steps", `${step.slug}.tsx`), "utf8");
      describe(`${path.slug}/${step.slug}`, () => {
        it("has no end-of-page 'What this … simplifies' list: simplifications go where they apply, with simplified()", () => {
          expect(src).not.toMatch(/title="What this [a-z]+ simplifies"/);
        });

        if (step.kind !== "lab") {
          it("has 'What to take away' then 'What if…', in that order", () => {
            const take = src.indexOf('<WriteupSection id="takeaways"');
            const what = src.indexOf('<WriteupSection id="what-if"');
            expect(take, 'add <WriteupSection id="takeaways" title="What to take away">').toBeGreaterThan(-1);
            expect(what, 'add <WriteupSection id="what-if" title="What if…">').toBeGreaterThan(take);
          });

          it("asks its what-if questions: in bold, or as the section title when there is one case", () => {
            const section = src.slice(src.indexOf('<WriteupSection id="what-if"'));
            const titled = /^<WriteupSection id="what-if"\s+title="[^"]*\?"/.test(section);
            const questions = [...section.matchAll(/<strong>([\s\S]*?)<\/strong>/g)].map((m) => m[1]);
            expect(titled || questions.some((q) => /\?\s*$/.test(q)), "start each answer with <strong>…a question?</strong>").toBe(true);
          });
        } else {
          it("puts a 'Simplified here' box before the prediction cards", () => {
            const box = src.indexOf("{simplified(");
            expect(box, "add {simplified([…], <>…</>)} between the intro and the predictions").toBeGreaterThan(-1);
            expect(box).toBeLessThan(src.search(/<Predict\b/));
          });
        }
      });
    }
  }
});
