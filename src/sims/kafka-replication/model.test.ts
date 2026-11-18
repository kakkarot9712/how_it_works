import { describe, expect, it } from "vitest";
import { Runtime } from "@/engine/runtime";
import { BROKERS, defaultComponents, defaultSettings, model, type Action, type Components, type Settings } from "./model";
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
const lost = (r: R) => r.state.producer.records.filter((x) => x.lost).length;
const acked = (r: R) => r.state.producer.records.filter((x) => x.status === "acked" && !x.lost).length;
const said = (r: R, text: string) => r.log.some((l) => l.text.includes(text));

describe("Kafka replication model", () => {
  it("happy path: everything acknowledged and committed, no warnings, replicas identical", () => {
    const r = run("happy");
    expect(r.log.filter((l) => l.level === "warn" || l.level === "error")).toEqual([]);
    expect(acked(r)).toBeGreaterThan(40);
    expect(lost(r)).toBe(0);
    const L = r.state.brokers[1];
    for (const b of [2, 3] as const) expect(r.state.brokers[b].log).toEqual(L.log.slice(0, r.state.brokers[b].log.length));
    // every acknowledged record is below the leader's high watermark (acks=all)
    for (const x of r.state.producer.records.filter((y) => y.status === "acked")) expect(x.offset!).toBeLessThan(L.hw);
  });

  it("acks=all is answered only after the high watermark passes the record", () => {
    const r = new Runtime(model, { settings: defaultSettings, components: defaultComponents }, { seed: 42 });
    let maxGap = 0;
    for (let t = 0; t < 10000; t += 50) {
      r.advanceTo(t);
      for (const x of r.state.producer.records.filter((y) => y.status === "acked")) maxGap = Math.max(maxGap, x.offset! - r.state.brokers[1].hw + 1);
    }
    expect(maxGap).toBeLessThanOrEqual(0);
  });

  it("slow follower: writes wait, the ISR shrinks after replica.lag.time.max.ms, the follower rejoins", () => {
    const r = run("slow-follower", 12000);
    expect(r.state.ctl.isr).toEqual([1, 2]);
    const shrink = r.log.find((l) => l.text.includes("Shrinking ISR from 1,2,3 to 1,2"))!;
    expect(shrink.t).toBeGreaterThanOrEqual(4000 + defaultSettings.lagMaxMs);
    r.advanceTo(30000);
    expect(r.state.ctl.isr).toEqual([1, 2, 3]);
    expect(lost(r)).toBe(0);
  });

  it("without ISR shrinking, a stalled follower holds acks=all writes until the producer times out", () => {
    const r = run("slow-follower", 15500, { components: { isrShrink: false } });
    expect(r.state.ctl.isr).toEqual([1, 2, 3]);
    expect(said(r, "Shrinking ISR")).toBe(false);
    expect(said(r, "got no answer within request.timeout.ms")).toBe(true);
    expect(r.state.duplicates).toBe(0); // idempotence: resends are written once
  });

  it("acks=1: a clean failover still loses acknowledged records, and the old leader truncates them", () => {
    const r = run("acks1-loss");
    expect(lost(r)).toBe(4);
    expect(r.state.ctl.leader).toBe(2);
    expect(said(r, "broker-1 truncates its log")).toBe(true);
    const ids = new Set(r.state.brokers[2].log.map((x) => x.id));
    for (const x of r.state.producer.records.filter((y) => y.lost)) expect(ids.has(x.id)).toBe(false);
  });

  it("acks=all: the same failure loses nothing acknowledged", () => {
    const r = run("acks-all");
    expect(lost(r)).toBe(0);
    expect(r.state.duplicates).toBe(0);
    const ids = new Set(r.state.brokers[2].log.map((x) => x.id));
    for (const x of r.state.producer.records.filter((y) => y.status === "acked")) expect(ids.has(x.id)).toBe(true);
  });

  it("acks=all without idempotence: the resend after the crash can write a record twice", () => {
    const r = run("acks-all", 30000, { components: { idempotence: false } });
    expect(r.state.duplicates).toBeGreaterThan(0);
  });

  it("min.insync.replicas=2: writes refused while the ISR is one broker, then resume", () => {
    const r = run("min-isr", 18000);
    expect(r.state.ctl.isr).toEqual([1]);
    expect(said(r, "NOT_ENOUGH_REPLICAS")).toBe(true);
    const hw = r.state.brokers[1].hw;
    r.advanceTo(18900);
    expect(r.state.brokers[1].hw).toBe(hw); // the high watermark doesn't move under min ISR
    r.advanceTo(30000);
    expect(said(r, "Writes succeed again")).toBe(true);
    expect(lost(r)).toBe(0);
  });

  it("acks=1 under min ISR: acknowledged but not committed", () => {
    const script: { at: number; action: Action }[] = [
      { at: 0, action: { type: "set-acks", acks: 1 } },
      { at: 2000, action: { type: "crash", b: 2 } },
      { at: 2000, action: { type: "crash", b: 3 } },
    ];
    const r = new Runtime(model, { settings: { ...defaultSettings, minIsr: 2 }, components: defaultComponents }, { seed: 42, script });
    r.advanceTo(15000);
    const L = r.state.brokers[1];
    expect(L.log.length - L.hw).toBeGreaterThan(10);
    expect(r.state.producer.records.filter((x) => x.status === "acked" && x.offset! >= L.hw).length).toBeGreaterThan(10);
  });

  it("offline: with unclean election off, the partition waits for broker-1 and loses nothing", () => {
    const r = run("offline", 18000);
    expect(r.state.ctl.leader).toBeNull();
    expect(r.state.ctl.elr).toEqual([1]);
    r.advanceTo(30000);
    expect(r.state.ctl.leader).toBe(1);
    expect(lost(r)).toBe(0);
  });

  it("unclean: available again quickly, acknowledged records lost", () => {
    const r = run("unclean");
    expect(r.state.ctl.leader).toBe(2);
    expect(lost(r)).toBe(16);
    expect(said(r, "Unclean election")).toBe(true);
  });

  it("unclean scenario with min.insync.replicas=2: broker-2 is elected from the ELR and nothing is lost", () => {
    const r = run("unclean", 30000, { settings: { minIsr: 2 } });
    expect(said(r, "Unclean election")).toBe(false);
    expect(r.state.ctl.leader).toBe(2);
    expect(lost(r)).toBe(0);
  });

  it("an operator can force an unclean election on an offline partition", () => {
    const sc = scenarios.find((s) => s.id === "offline")!;
    const r = new Runtime(model, { settings: defaultSettings, components: defaultComponents }, { seed: 42, script: [...sc.script.filter((a) => a.at < 20000), { at: 17000, action: { type: "unclean-election" } }] });
    r.advanceTo(19000);
    expect(r.state.ctl.leader).not.toBeNull();
    expect(lost(r)).toBeGreaterThan(0);
  });

  it("a cut-off leader is replaced; it learns and truncates when the network returns", () => {
    const script: { at: number; action: Action }[] = [
      { at: 3000, action: { type: "set-cut", b: 1, on: true } },
      { at: 12000, action: { type: "set-cut", b: 1, on: false } },
    ];
    const r = new Runtime(model, { settings: defaultSettings, components: defaultComponents }, { seed: 42, script });
    r.advanceTo(11000);
    expect(r.state.ctl.leader).not.toBe(1);
    expect(r.state.brokers[1].view.leader).toBe(1); // still thinks it leads
    r.advanceTo(25000);
    expect(r.state.brokers[1].view.leader).toBe(r.state.ctl.leader);
    expect(lost(r)).toBe(0);
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

  it("brokers keep only the records the leader has, after things settle", () => {
    for (const sc of scenarios) {
      const r = run(sc.id, 30000);
      const leader = r.state.ctl.leader;
      if (leader === null) continue;
      const L = r.state.brokers[leader].log;
      for (const b of BROKERS) {
        const br = r.state.brokers[b];
        if (!br.up) continue;
        expect(br.log, `${sc.id}: broker-${b}`).toEqual(L.slice(0, br.log.length));
      }
    }
  });
});
