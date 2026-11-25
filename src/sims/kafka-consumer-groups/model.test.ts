import { describe, expect, it } from "vitest";
import { Runtime } from "@/engine/runtime";
import { defaultComponents, defaultSettings, lagOf, model, murmur2, partitionForKey, KEYS, KEY_FOR_PARTITION, type Components, type Settings } from "./model";
import { scenarios } from "./scenarios";

function run(id: string, until = 30000, over: { settings?: Partial<Settings>; components?: Partial<Components> } = {}) {
  const sc = scenarios.find((s) => s.id === id)!;
  const r = new Runtime(
    model,
    {
      settings: { ...defaultSettings, ...sc.settings, ...over.settings } as Settings,
      components: { ...defaultComponents, ...sc.components, ...over.components } as Components,
    },
    { seed: 42, script: sc.script },
  );
  r.advanceTo(until);
  return r;
}
const logs = (r: ReturnType<typeof run>, level?: string) => r.log.filter((l) => !level || l.level === level);

describe("kafka-consumer-groups", () => {
  it("murmur2 matches Kafka's test vectors", () => {
    expect(murmur2("21")).toBe(-973932308);
    expect(murmur2("foobar")).toBe(-790332482);
    expect(murmur2("a-little-bit-long-string")).toBe(-985981536);
    expect(murmur2("a-little-bit-longer-string")).toBe(-1486304829);
    expect(murmur2("lkjh234lh9fiuh90y23oiuhsafujhadof229phr9h19h89h8")).toBe(-58897971);
    expect(murmur2("abc")).toBe(479470107);
  });

  it("keys map to the partitions the UI states", () => {
    expect(KEYS.map((k) => partitionForKey(k))).toEqual([1, 0, 1, 0, 2, 2]);
    expect(KEY_FOR_PARTITION.map((k) => partitionForKey(k))).toEqual([0, 1, 2]);
  });

  it("happy path: no warnings, no duplicates, small lag, every record keyed to its partition", () => {
    const r = run("happy");
    expect(logs(r).filter((l) => l.level === "warn" || l.level === "error")).toEqual([]);
    expect(r.state.duplicates).toBe(0);
    expect(r.state.lost).toBe(0);
    for (const p of [0, 1, 2]) {
      expect(lagOf(r.state, p)).toBeLessThan(10);
      for (const rec of r.state.partitions[p].log) expect(partitionForKey(rec.key)).toBe(p);
    }
  });

  it("scale-out: one partition moves, consumer-2 keeps its partition, consumer-4 gets none", () => {
    const r = run("scale-out");
    const revokes = logs(r).filter((l) => l.t > 6000 && l.text.includes("revokes"));
    expect(revokes.map((l) => l.text)).toEqual(["consumer-1 revokes orders-1 and keeps orders-0"]);
    expect(r.state.consumers[2].owned).toEqual([2]);
    expect(r.state.consumers[4].up).toBe(true);
    expect(r.state.consumers[4].owned).toEqual([]);
    expect(r.state.coord.state).toBe("Stable");
  });

  it("crash: partitions move after the session timeout and records are processed twice", () => {
    const r = run("crash-duplicates");
    const expiry = logs(r).find((l) => l.text.includes("No heartbeat from consumer-1"))!;
    expect(expiry.t - 9000).toBeGreaterThanOrEqual(defaultSettings.sessionMs - 1000);
    expect(r.state.duplicates).toBeGreaterThan(0);
    expect(r.state.lost).toBe(0);
  });

  it("at-most-once: records are lost and none duplicated", () => {
    const r = run("at-most-once");
    expect(r.state.lost).toBeGreaterThan(0);
    expect(r.state.duplicates).toBe(0);
    expect(logs(r).find((l) => l.text.includes("never processed"))!.t).toBeGreaterThan(10000);
  });

  it("stop-the-world: on the classic protocol every member revokes everything", () => {
    const r = run("stop-the-world");
    const after = logs(r).filter((l) => l.t > 6000 && l.text.includes("revokes"));
    expect(after.map((l) => l.text)).toEqual(["consumer-1 revokes orders-0, orders-1 and rejoins", "consumer-2 revokes orders-2 and rejoins"]);
    expect([1, 2, 3].map((c) => r.state.consumers[c].owned)).toEqual([[0], [1], [2]]);
  });

  it("slow consumer: poll timeout, not session timeout; its commit fails", () => {
    const r = run("slow-consumer");
    expect(logs(r).some((l) => l.text.includes("consumer-1: poll timeout expired"))).toBe(true);
    expect(logs(r).some((l) => l.text.includes("No heartbeat"))).toBe(false);
    expect(logs(r).some((l) => l.text.includes("CommitFailedException"))).toBe(true);
    expect(r.state.duplicates).toBeGreaterThan(0);
  });

  it("poison: jams consumer-2, then consumer-1, and the group ends empty; dead-lettering fixes it", () => {
    const r = run("poison");
    expect(logs(r).filter((l) => l.text.includes("fails on orders-2@4")).length).toBe(2);
    expect(r.state.coord.state).toBe("Empty");
    const fixed = run("poison", 30000, { components: { deadLetter: true } });
    expect(fixed.state.consumers[2].dlqCount).toBe(1);
    expect(lagOf(fixed.state, 2)).toBeLessThan(10);
  });

  it("hot key: orders-1 lags, the others don't", () => {
    const r = run("hot-key");
    expect(lagOf(r.state, 1)).toBeGreaterThan(20);
    expect(lagOf(r.state, 0)).toBeLessThan(5);
    expect(lagOf(r.state, 2)).toBeLessThan(5);
  });

  it("without key partitioning a key's records are processed out of order", () => {
    const r = run("happy", 30000, { components: { keyPartitioning: false }, settings: { consumers: 3 } });
    expect(r.state.outOfOrder).toBeGreaterThan(0);
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
