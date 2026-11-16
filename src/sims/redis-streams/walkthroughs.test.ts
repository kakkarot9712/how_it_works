import { describe, expect, it } from "vitest";
import { Runtime } from "@/engine/runtime";
import { defaultComponents, defaultSettings, lag, model, type Components, type Settings } from "./model";
import { scenarios } from "./scenarios";
import { walkthroughs } from "./walkthroughs";

function runner(id: string) {
  const sc = scenarios.find((s) => s.id === id)!;
  return new Runtime(
    model,
    {
      settings: { ...defaultSettings, ...sc.settings } as Settings,
      components: { ...defaultComponents, ...sc.components } as Components,
    },
    { seed: 42, script: sc.script },
  );
}

/** The write-up's scenario walkthroughs must describe what the model actually does, when it does it. */
describe("redis streams walkthroughs", () => {
  it("cover every scenario, in order", () => {
    expect(walkthroughs.map((w) => w.id)).toEqual(scenarios.map((s) => s.id));
  });

  for (const w of walkthroughs) {
    it(`${w.id}: every timed moment matches the narration`, () => {
      const r = runner(w.id);
      const last = Math.max(0, ...w.moments.map((m) => m.t ?? 0));
      r.advanceTo(last + 1000);
      let prev = -Infinity;
      for (const m of w.moments) {
        if (m.t === undefined) continue;
        expect(m.t, "moments are in time order").toBeGreaterThanOrEqual(prev);
        prev = m.t;
        if (!m.log) continue;
        const hit = r.log.some((l) => l.text.includes(m.log!) && Math.abs(l.t - m.t!) <= 400);
        expect(hit, `"${m.log}" near ${m.t}ms`).toBe(true);
      }
    });
  }

  it("catch-up: lag is 10 at 10.5s and back to 1 at 20.5s", () => {
    const r = runner("catch-up");
    r.advanceTo(10500);
    expect(lag(r.state, r.state.groups.analytics)).toBe(10);
    r.advanceTo(20500);
    expect(lag(r.state, r.state.groups.analytics)).toBe(1);
  });

  it("dead-consumer: mailer-1 holds orders 10-13, all idle past min-idle-time at 12.5s", () => {
    const r = runner("dead-consumer");
    r.advanceTo(12500);
    const mine = r.state.groups.mailers.pel.filter((p) => p.owner === "C1");
    expect(mine.map((p) => p.order)).toEqual([10, 11, 12, 13]);
    expect(mine.every((p) => 12500 - p.deliveredAt >= defaultSettings.minIdleMs)).toBe(true);
  });

  it("hung: mailer-1 hangs mid-order 10 with 11-13 queued", () => {
    const r = runner("hung");
    r.advanceTo(6500);
    const c = r.state.consumers.C1;
    expect(c.processing?.order).toBe(10);
    expect(c.queue.map((d) => d.order)).toEqual([11, 12, 13]);
  });

  it("trim: analytics resumes at order 13, after 10 entries trimmed unread", () => {
    const r = runner("trim");
    r.advanceTo(21000);
    expect(r.state.groups.analytics.trimmedUnread).toBe(10);
    expect([...r.state.consumers.C3.recent].reverse().filter((o) => o > 2)[0]).toBe(13);
  });

  it("noack: mailer-1 restarts at 9.5s and nothing is pending", () => {
    const r = runner("noack");
    r.advanceTo(9600);
    expect(r.state.consumers.C1.status).toBe("running");
    expect(r.state.groups.mailers.pel).toEqual([]);
    expect(r.state.groups.mailers.lostNoAck).toBe(4);
  });
});
