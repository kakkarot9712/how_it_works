import { describe, expect, it } from "vitest";
import { Runtime } from "@/engine/runtime";
import { committedValue, defaultComponents, defaultSettings, model, type Components, type Settings } from "./model";
import { RUN_MS, scenarios } from "./scenarios";

function run(id: string, until = RUN_MS, over: { settings?: Partial<Settings>; components?: Partial<Components> } = {}) {
  const sc = scenarios.find((s) => s.id === id)!;
  const params = {
    settings: { ...defaultSettings, ...sc.settings, ...over.settings } as Settings,
    components: { ...defaultComponents, ...sc.components, ...over.components } as Components,
  };
  const r = new Runtime(model, params, { seed: 42, script: sc.script, maxDuration: RUN_MS });
  r.advanceTo(until);
  return r;
}
const texts = (r: ReturnType<typeof run>) => r.log.map((l) => l.text);
const value = (r: ReturnType<typeof run>, row: "alice" | "bob" | "carol") => committedValue(r.state, row);

describe("postgres isolation model", () => {
  it("happy path: a concurrent report sees a consistent total and nothing warns", () => {
    const r = run("snapshots");
    expect(r.log.filter((l) => l.level === "warn" || l.level === "error")).toEqual([]);
    const b = r.state.sessions.B.lines.filter((l) => l.result?.startsWith("sum"));
    expect(b.map((l) => l.result)).toEqual(["sum = 200", "sum = 200"]);
    expect(value(r, "alice")).toBe(70);
    expect(value(r, "bob")).toBe(130);
    // The old versions stay in the table, stamped with A's xid.
    expect(r.state.versions.filter((v) => v.xmax === 740)).toHaveLength(2);
  });

  it("happy path: B's first sum ran while A's transaction was in progress", () => {
    const r = run("snapshots", 3900);
    expect(r.state.xact[740]).toBe("in progress");
    expect(r.state.sessions.B.lastSum).toBe(200);
  });

  it("read uncommitted never reads dirty data, and the rollback leaves alice at 100", () => {
    const r = run("read-uncommitted");
    expect(r.state.sessions.B.saved).toBe(100);
    expect(r.state.xact[740]).toBe("aborted");
    expect(value(r, "alice")).toBe(100);
    expect(texts(r).some((t) => t.startsWith("No dirty read"))).toBe(true);
  });

  it("read committed: the second SELECT * sees A's update and insert", () => {
    const r = run("non-repeatable");
    expect(texts(r).some((t) => t.startsWith("Non-repeatable read"))).toBe(true);
    expect(texts(r).some((t) => t.startsWith("Phantom read"))).toBe(true);
  });

  it("the same reads at repeatable read are stable", () => {
    const r = run("non-repeatable", RUN_MS, { settings: { isolation: 2 } });
    expect(texts(r).some((t) => t.startsWith("Non-repeatable read") || t.startsWith("Phantom read"))).toBe(false);
    const reads = r.state.sessions.B.lines.filter((l) => l.sql === "SELECT * FROM accounts").map((l) => l.result);
    expect(reads).toEqual(["alice 100, bob 100", "alice 100, bob 100"]);
  });

  it("lost update at read committed: both commit and alice ends at 130, not 180", () => {
    const r = run("lost-update");
    expect(value(r, "alice")).toBe(130);
    expect(r.state.lostUpdates).toBe(1);
    expect(r.state.sessions.A.commits + r.state.sessions.B.commits).toBe(2);
    expect(r.state.serializationFailures).toBe(0);
  });

  it("SELECT … FOR UPDATE in both deposits: the second waits for the lock, reads the new value, nothing is lost", () => {
    const r = new Runtime(model, { settings: defaultSettings, components: defaultComponents }, {
      seed: 42,
      script: [
        { at: 1000, action: { type: "run", s: "A", program: "deposit-30-locked" } },
        { at: 1600, action: { type: "run", s: "B", program: "deposit-30-locked" } },
      ],
      maxDuration: RUN_MS,
    });
    r.advanceTo(RUN_MS);
    expect(value(r, "alice")).toBe(160);
    expect(r.state.lostUpdates).toBe(0);
  });

  it("first updater wins at repeatable read: B fails with 40001, retries, and alice ends at 180", () => {
    const r = run("first-updater-wins");
    expect(texts(r)).toContain("ERROR: could not serialize access due to concurrent update");
    expect(r.state.sessions.B.retries).toBe(1);
    expect(value(r, "alice")).toBe(180);
    expect(r.state.lostUpdates).toBe(0);
  });

  it("without the retry block the deposit is lost to the user, not silently", () => {
    const r = run("first-updater-wins", RUN_MS, { components: { retry: false } });
    expect(value(r, "alice")).toBe(150);
    expect(r.state.sessions.B.status).toBe("failed");
    expect(r.state.lostUpdates).toBe(0);
  });

  it("without the repeatable read write check the lost update comes back", () => {
    const r = run("first-updater-wins", RUN_MS, { components: { writeCheck: false } });
    expect(value(r, "alice")).toBe(130);
    expect(r.state.lostUpdates).toBe(1);
  });

  it("write skew at repeatable read: both withdrawals commit and the rule breaks", () => {
    const r = run("write-skew");
    expect(value(r, "alice")).toBe(-50);
    expect(value(r, "bob")).toBe(-50);
    expect(r.state.ruleBroken).toBe(true);
    expect(r.state.sessions.A.wait).toBeNull();
  });

  it("serializable: B's commit fails as the pivot, its retry refuses, the rule holds", () => {
    const r = run("serializable");
    expect(texts(r)).toContain("ERROR: could not serialize access due to read/write dependencies among transactions");
    expect(r.state.sessions.B.status).toBe("refused");
    expect(value(r, "alice")).toBe(-50);
    expect(value(r, "bob")).toBe(100);
    expect(r.state.ruleBroken).toBe(false);
    const err = r.log.find((l) => l.text.startsWith("ERROR: could not serialize"))!;
    expect(err.detail).toContain("Canceled on identification as a pivot, during commit attempt.");
  });

  it("serializable without SSI is just repeatable read: write skew commits", () => {
    const r = run("serializable", RUN_MS, { components: { ssi: false } });
    expect(r.state.ruleBroken).toBe(true);
    expect(r.state.serializationFailures).toBe(0);
  });

  it("deadlock: one transaction is aborted with 40P01 after deadlock_timeout, both transfers end up applied", () => {
    const r = run("deadlock");
    expect(r.state.deadlocks).toBe(1);
    const dl = r.log.find((l) => l.text.startsWith("ERROR: deadlock detected"))!;
    const wait = r.log.find((l) => l.text.startsWith("Session B's UPDATE waits"))!;
    expect(dl.t - wait.t).toBeCloseTo(defaultSettings.deadlockTimeoutMs, 0);
    expect(dl.detail).toContain("Process 4243 waits for ShareLock on transaction 740; blocked by process 4242.");
    expect(value(r, "alice")).toBe(90);
    expect(value(r, "bob")).toBe(110);
  });

  it("without the deadlock detector both sessions wait forever", () => {
    const r = run("deadlock", RUN_MS, { components: { deadlock: false } });
    expect(r.state.deadlocks).toBe(0);
    expect(r.state.sessions.A.wait).not.toBeNull();
    expect(r.state.sessions.B.wait).not.toBeNull();
  });

  it("pg_cancel_backend aborts a waiting transaction and frees the other", () => {
    const sc = scenarios.find((s) => s.id === "deadlock")!;
    const r = new Runtime(model, { settings: defaultSettings, components: { ...defaultComponents, deadlock: false } }, {
      seed: 42,
      script: [...sc.script, { at: 8000, action: { type: "cancel", s: "A" } }],
      maxDuration: RUN_MS,
    });
    r.advanceTo(RUN_MS);
    expect(texts(r).some((t) => t.startsWith("pg_cancel_backend(4242)"))).toBe(true);
    expect(r.state.sessions.B.commits).toBe(1);
    expect(r.state.sessions.A.wait).toBeNull();
  });

  it("a stuck app keeps its row lock, and the other session waits until it is terminated", () => {
    const r = new Runtime(model, { settings: defaultSettings, components: defaultComponents }, {
      seed: 42,
      script: [
        { at: 0, action: { type: "exec", s: "A", stmt: { op: "begin", level: 1 } } },
        { at: 1000, action: { type: "exec", s: "A", stmt: { op: "update", row: "alice", delta: 10, intent: 10 } } },
        { at: 2000, action: { type: "set-stalled", s: "A", on: true } },
        { at: 3000, action: { type: "exec", s: "B", stmt: { op: "update", row: "alice", delta: 5, intent: 5 } } },
        { at: 9000, action: { type: "terminate", s: "A" } },
      ],
      maxDuration: RUN_MS,
    });
    r.advanceTo(8000);
    expect(r.state.sessions.B.wait).not.toBeNull();
    r.advanceTo(12000);
    expect(r.state.sessions.B.wait).toBeNull();
    expect(value(r, "alice")).toBe(105); // A's +10 was rolled back; B's autocommit +5 went through
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
