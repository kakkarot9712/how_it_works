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
import { termsIn } from "@/lib/source-terms";
import { DEFAULT_DURATION_MS } from "@/sims/types";
import { allPaths, getStep, stepsOf } from "./catalog";
import { pathContent } from "./content";

const ROOT = join(process.cwd(), "src/paths");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const citedIn = (src: string) => [...src.matchAll(/cite\(([^)]*)\)/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));

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
