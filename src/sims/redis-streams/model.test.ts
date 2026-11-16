import { describe, expect, it } from "vitest";
import { Runtime } from "@/engine/runtime";
import { defaultComponents, defaultSettings, model, type Components, type Settings } from "./model";
import { scenarios } from "./scenarios";

function run(id: string, until: number) {
  const sc = scenarios.find((s) => s.id === id)!;
  const params = {
    settings: { ...defaultSettings, ...sc.settings } as Settings,
    components: { ...defaultComponents, ...sc.components } as Components,
  };
  const r = new Runtime(model, params, { seed: 42, script: sc.script });
  r.advanceTo(until);
  return r;
}
const texts = (r: ReturnType<typeof run>) => r.log.map((l) => l.text);

describe("redis streams model", () => {
  it("happy path: mailers split the work, analytics gets everything, nothing is lost or duplicated", () => {
    const r = run("happy", 30000);
    const { mailers, analytics } = r.state.groups;
    const c = r.state.consumers;
    expect(c.C1.done).toBeGreaterThan(10);
    expect(c.C2.done).toBeGreaterThan(10);
    expect(c.C1.done + c.C2.done).toBeGreaterThan(c.C3.done - 3);
    expect(Object.values(mailers.processed).every((n) => n === 1)).toBe(true);
    expect(Object.values(analytics.processed).every((n) => n === 1)).toBe(true);
    // Every order went to exactly one mailer.
    expect(Object.keys(mailers.processed).length).toBe(c.C1.done + c.C2.done);
    expect(mailers.pel.length).toBeLessThanOrEqual(3);
  });

  it("happy path stays quiet: no warnings over a long run", () => {
    const r = run("happy", 120000);
    expect(r.log.filter((l) => l.level === "warn" || l.level === "error")).toEqual([]);
    expect(r.state.groups.mailers.claimed).toBe(0);
  });

  it("entry IDs are <ms>-<seq> and strictly increasing", () => {
    const r = run("dead-consumer", 8000);
    const ids = r.state.stream.entries.map((e) => e.id.split("-").map(Number));
    for (let i = 1; i < ids.length; i++) {
      const [a, b] = [ids[i - 1], ids[i]];
      expect(b[0] > a[0] || (b[0] === a[0] && b[1] > a[1])).toBe(true);
    }
  });

  it("a consumer that was offline catches up from its group's last-delivered-id", () => {
    const r = run("catch-up", 10900);
    const g = r.state.groups.analytics;
    expect(g.lastN).toBeLessThan(r.state.stream.entriesAdded - 8);
    r.advanceTo(30000);
    expect(r.state.groups.analytics.trimmedUnread).toBe(0);
    expect(r.state.stream.entriesAdded - r.state.groups.analytics.lastN).toBeLessThanOrEqual(defaultSettings.count);
    // Nothing missed: every order the stream got was processed by analytics (except the newest few).
    expect(Object.keys(r.state.groups.analytics.processed).length).toBeGreaterThan(r.state.stream.entriesAdded - 4);
  });

  it("a dead consumer's pending entries are XAUTOCLAIMed by the other mailer", () => {
    const r = run("dead-consumer", 7100);
    const held = r.state.groups.mailers.pel.filter((p) => p.owner === "C1").length;
    expect(held).toBeGreaterThanOrEqual(3);
    r.advanceTo(16000);
    const g = r.state.groups.mailers;
    expect(g.claimed).toBe(held);
    expect(g.pel.filter((p) => p.owner === "C1")).toEqual([]);
    expect(texts(r).some((t) => t.includes("mailer-2 XAUTOCLAIMed"))).toBe(true);
  });

  it("without the claim loop, a dead consumer's entries stay pending", () => {
    const sc = scenarios.find((s) => s.id === "dead-consumer")!;
    const r = new Runtime(model, { settings: defaultSettings, components: { ...defaultComponents, claim: false } }, { seed: 42, script: sc.script });
    r.advanceTo(40000);
    expect(r.state.groups.mailers.pel.filter((p) => p.owner === "C1").length).toBeGreaterThanOrEqual(3);
    expect(r.state.groups.mailers.claimed).toBe(0);
  });

  it("a hung consumer's entries are claimed, then processed twice when it wakes", () => {
    const r = run("hung", 25000);
    const g = r.state.groups.mailers;
    expect(g.claimed).toBeGreaterThanOrEqual(3);
    expect(r.state.consumers.C1.dups).toBeGreaterThanOrEqual(3);
    expect(texts(r).some((t) => t.includes("a second time"))).toBe(true);
  });

  it("a poison entry crash-loops until the delivery count dead-letters it", () => {
    const r = run("poison", 20000);
    expect(r.state.consumers.C1.crashes + r.state.consumers.C2.crashes).toBe(defaultSettings.maxDeliveries);
    expect(r.state.deadLetter).toHaveLength(1);
    expect(r.state.deadLetter[0].deliveries).toBe(defaultSettings.maxDeliveries + 1);
    expect(r.state.consumers.C3.crashes).toBe(0);
    expect(r.state.groups.mailers.pel.some((p) => p.order === r.state.deadLetter[0].order)).toBe(false);
  });

  it("without dead-lettering, the poison entry crashes consumers forever", () => {
    const sc = scenarios.find((s) => s.id === "poison")!;
    const r = new Runtime(model, { settings: defaultSettings, components: { ...defaultComponents, deadLetter: false } }, { seed: 42, script: sc.script });
    r.advanceTo(40000);
    expect(r.state.deadLetter).toHaveLength(0);
    expect(r.state.consumers.C1.crashes + r.state.consumers.C2.crashes).toBeGreaterThan(6);
  });

  it("MAXLEN trims entries the lagging group never read, and lag becomes nil", () => {
    const r = run("trim", 15000);
    const g = r.state.groups.analytics;
    expect(g.trimmedUnread).toBeGreaterThan(3);
    expect(g.lagValid).toBe(false);
    expect(r.state.stream.entries.length).toBe(10);
    r.advanceTo(30000);
    expect(r.state.groups.analytics.lagValid).toBe(true);
  });

  it("NOACK: the PEL stays empty and a crash loses what the consumer held", () => {
    const r = run("noack", 20000);
    expect(r.state.groups.mailers.pel).toEqual([]);
    expect(r.state.groups.mailers.lostNoAck).toBeGreaterThanOrEqual(3);
    expect(r.state.groups.mailers.claimed).toBe(0);
  });

  it("Redis restart: stream and groups survive, XADD fails while down, lost XACKs cause duplicates", () => {
    const r = run("restart", 6000);
    const added = r.state.stream.entriesAdded;
    expect(r.state.server.up).toBe(false);
    r.advanceTo(20000);
    expect(r.state.server.up).toBe(true);
    expect(r.state.stream.entriesAdded).toBeGreaterThan(added);
    expect(r.state.producers.P1.failed).toBeGreaterThan(0);
    const dups = r.state.groups.mailers.duplicates + r.state.groups.analytics.duplicates;
    expect(dups).toBeGreaterThan(0);
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
