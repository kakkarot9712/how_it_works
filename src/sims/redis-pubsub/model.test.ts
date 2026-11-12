import { describe, expect, it } from "vitest";
import { Runtime } from "@/engine/runtime";
import { defaultComponents, defaultSettings, globMatch, model, type Components, type Settings } from "./model";
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

describe("redis pub/sub model", () => {
  it("matches globs like Redis", () => {
    expect(globMatch("pay*", "payments")).toBe(true);
    expect(globMatch("pay*", "orders")).toBe(false);
    expect(globMatch("order?", "orders")).toBe(true);
    expect(globMatch("a.b*", "axb")).toBe(false);
  });

  it("happy path delivers without loss", () => {
    const r = run("fan-out", 20000);
    const subs = Object.values(r.state.subscribers);
    expect(subs.every((s) => s.received > 5 && s.lost === 0 && s.disconnects === 0)).toBe(true);
    // fraud-check only receives payments, via the pattern
    expect(r.state.subscribers.S3.recent.every((m) => m.channel === "payments")).toBe(true);
  });

  it("happy path stays quiet: no warnings, no buffer pressure", () => {
    const r = run("fan-out", 60000);
    expect(r.log.filter((l) => l.level === "warn" || l.level === "error")).toEqual([]);
    expect(Object.values(r.state.subscribers).every((s) => s.peakBytes < 8 * 1024)).toBe(true);
  });

  it("only one soft-limit warning per connection, even when hovering at the line", () => {
    const r = run("hard-limit", 30000);
    const warns = r.log.filter((l) => l.text.includes("analytics") && l.text.includes("soft limit"));
    expect(warns.length).toBeLessThanOrEqual(1);
  });

  it("publishing to a channel without subscribers returns 0", () => {
    const r = run("void", 6000);
    expect(r.state.stats.noReceivers).toBe(1);
    expect(r.state.publishers.P2.lastReply?.text).toBe("(integer) 2");
    expect(texts(r).some((t) => t.includes("refunds") && t.includes("0 subscribers"))).toBe(true);
  });

  it("offline subscriber misses messages and gets them never", () => {
    const r = run("offline", 14000);
    const s2 = r.state.subscribers.S2;
    expect(s2.missed).toBeGreaterThan(3);
    expect(s2.registered).toBe(true);
    expect(texts(r).some((t) => t.includes("missed"))).toBe(true);
  });

  it("stuck consumer is closed by the hard limit and buffered messages are lost", () => {
    const r = run("hard-limit", 15000);
    const s1 = r.state.subscribers.S1;
    expect(s1.disconnects).toBeGreaterThanOrEqual(1);
    expect(s1.lost).toBeGreaterThan(0);
    expect(texts(r).some((t) => t.includes("overcoming of output buffer limits"))).toBe(true);
    expect(r.state.subscribers.S2.disconnects).toBe(0);
  });

  it("slow consumer is closed by the soft limit, not the hard one", () => {
    const r = run("soft-limit", 25000);
    const s3 = r.state.subscribers.S3;
    expect(s3.disconnects).toBeGreaterThanOrEqual(1);
    expect(s3.peakBytes).toBeLessThan(64 * 1024);
  });

  it("partition leaves the subscriber half-open until the link heals", () => {
    const r = run("partition", 14000);
    const s2 = r.state.subscribers.S2;
    expect(s2.registered).toBe(false);
    expect(s2.client).toBe("connected"); // it still believes it is subscribed
    r.advanceTo(22000);
    expect(r.state.subscribers.S2.registered).toBe(true);
  });

  it("without limits a stuck consumer OOM-kills Redis and drops everyone", () => {
    const r = run("oom", 30000);
    expect(texts(r).some((t) => t.startsWith("Out of memory"))).toBe(true);
    expect(r.state.subscribers.S2.disconnects).toBeGreaterThanOrEqual(1);
    expect(r.state.subscribers.S3.disconnects).toBeGreaterThanOrEqual(1);
  });

  it("restart wipes subscriptions until clients re-subscribe", () => {
    const r = run("restart", 4100);
    expect(r.state.server.up).toBe(false);
    expect(Object.values(r.state.subscribers).every((s) => !s.registered)).toBe(true);
    r.advanceTo(15000);
    expect(r.state.server.up).toBe(true);
    expect(Object.values(r.state.subscribers).every((s) => s.registered)).toBe(true);
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
