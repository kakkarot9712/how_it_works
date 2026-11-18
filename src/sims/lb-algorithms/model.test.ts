import { describe, expect, it } from "vitest";
import { Runtime } from "@/engine/runtime";
import { defaultComponents, defaultSettings, LANES, model, percentile, type Action, type Components, type Settings } from "./model";
import { scenarios } from "./scenarios";

function run(id: string, until = 30000, over: { settings?: Partial<Settings>; components?: Partial<Components> } = {}) {
  const sc = scenarios.find((s) => s.id === id)!;
  const params = {
    settings: { ...defaultSettings, ...sc.settings, ...over.settings } as Settings,
    components: { ...defaultComponents, ...sc.components, ...over.components } as Components,
  };
  const r = new Runtime(model, params, { seed: 42, script: sc.script });
  r.advanceTo(until);
  return r;
}
type R = ReturnType<typeof run>;
const p95 = (r: R, lane: (typeof LANES)[number]) => percentile(r.state.lanes[lane].stats.recent, 95)!;
const p50 = (r: R, lane: (typeof LANES)[number]) => percentile(r.state.lanes[lane].stats.recent, 50)!;

describe("nginx load balancing model", () => {
  it("smooth weighted round robin follows nginx's order (weights 1, 1, 3)", () => {
    const script: { at: number; action: Action }[] = [
      { at: 0, action: { type: "set-traffic", on: false } },
      { at: 100, action: { type: "burst", heavy: false, n: 5 } },
    ];
    const r = new Runtime(model, { settings: { ...defaultSettings, weight3: 3 }, components: defaultComponents }, { seed: 42, script });
    r.advanceTo(400);
    // The first five picks: api-3, api-1, api-3, api-2, api-3.
    expect(r.state.lanes.rr.stats.sent).toEqual([1, 1, 3]);
  });

  it("happy path: every group serves everything, no warnings, round robin in strict turn", () => {
    const r = run("even");
    expect(r.log.filter((l) => l.level === "warn" || l.level === "error")).toEqual([]);
    for (const l of LANES) expect(r.state.lanes[l].stats.errors).toBe(0);
    const sent = r.state.lanes.rr.stats.sent;
    expect(Math.max(...sent) - Math.min(...sent)).toBeLessThanOrEqual(1);
  });

  it("all groups see the same requests", () => {
    const r = run("heavy");
    const totals = LANES.map((l) => r.state.lanes[l].stats.ok + r.state.lanes[l].stats.errors + Object.keys(r.state.lanes[l].reqs).length);
    expect(new Set(totals).size).toBe(1);
  });

  it("heavy requests: connection-counting methods keep the tail short, medians stay alike", () => {
    const r = run("heavy");
    expect(p95(r, "lc")).toBeLessThan(1200);
    expect(p95(r, "p2c")).toBeLessThan(1600);
    expect(p95(r, "rr")).toBeGreaterThan(1900);
    expect(p95(r, "random")).toBeGreaterThan(3500);
    for (const l of LANES) expect(p50(r, l)).toBeLessThan(1100);
  });

  it("slow server: round robin and random keep its share, least_conn and random two send it less", () => {
    const r = run("slow-server");
    const sent = (l: (typeof LANES)[number]) => r.state.lanes[l].stats.sent[1];
    expect(sent("lc")).toBeLessThanOrEqual(20);
    expect(sent("p2c")).toBeLessThanOrEqual(20);
    expect(sent("rr")).toBeGreaterThanOrEqual(29);
    expect(sent("random")).toBeGreaterThanOrEqual(29);
    expect(p95(r, "rr")).toBeGreaterThan(9000);
    expect(p95(r, "random")).toBeGreaterThan(9000);
    expect(p95(r, "lc")).toBeLessThan(3500);
    expect(p95(r, "p2c")).toBeLessThan(3500);
  });

  it("weights: three times the requests to the weight=3 server; without weights round robin suffers", () => {
    const r = run("weights");
    for (const l of ["rr", "lc", "p2c"] as const) {
      const [a, b, c] = r.state.lanes[l].stats.sent;
      expect(c / ((a + b) / 2)).toBeGreaterThan(2.7);
      expect(p95(r, l)).toBeLessThan(1500);
    }
    expect(p95(r, "random")).toBeGreaterThan(2800);
    const off = run("weights", 30000, { components: { weights: false } });
    expect(p95(off, "rr")).toBeGreaterThan(3500);
    expect(p95(off, "lc")).toBeLessThan(2000);
  });

  it("crash: retries hide it from clients, max_fails disables it, a probe brings it back", () => {
    const r = run("crash", 12000);
    for (const l of LANES) {
      expect(r.state.lanes[l].stats.errors).toBe(0);
      expect(r.state.lanes[l].stats.retries).toBeGreaterThan(0);
      expect(r.state.lanes[l].peers[1].fails).toBeGreaterThanOrEqual(1);
    }
    r.advanceTo(30000);
    for (const l of LANES) expect(r.state.lanes[l].peers[1].fails).toBe(0);
  });

  it("crash without retries: the client gets 502", () => {
    const r = run("crash", 30000, { components: { nextUpstream: false } });
    for (const l of LANES) expect(r.state.lanes[l].stats.errors).toBeGreaterThan(0);
    expect(r.log.some((l) => l.text.includes("gets 502 Bad Gateway"))).toBe(true);
  });

  it("black hole: without max_fails, least_conn sends the dead server the most attempts", () => {
    const r = run("black-hole");
    const L = r.state.lanes;
    expect(L.lc.stats.sent[1]).toBe(51);
    expect(L.lc.stats.retries).toBe(46);
    expect(L.rr.stats.retries).toBe(26);
    expect(L.p2c.stats.retries).toBe(36);
    for (const l of LANES) expect(L[l].stats.errors).toBe(0);
  });

  it("hang: timeouts retry elsewhere; least_conn retries least", () => {
    const r = run("hang");
    const L = r.state.lanes;
    expect([L.rr.stats.retries, L.random.stats.retries, L.lc.stats.retries, L.p2c.stats.retries]).toEqual([9, 6, 3, 3]);
    expect(p95(r, "rr")).toBeGreaterThan(6500);
    expect(p95(r, "lc")).toBeLessThan(3500);
    expect(r.log.some((l) => l.text.includes("upstream timed out"))).toBe(true);
  });

  it("every scenario survives rewind/replay deterministically", () => {
    for (const sc of scenarios) {
      const r = run(sc.id, 12000);
      const snap = structuredClone(r.state);
      r.seek(3333);
      r.seek(12000);
      expect(r.state, sc.id).toEqual(snap);
    }
  });
});
