import { describe, expect, it } from "vitest";
import { balancedAllocation, filterNode, leastAllocated, schedule, type SchedNode } from "./schedule";

// Expected values worked by hand from the Go formulas at v1.37.2 (see schedule.ts).
const n1: SchedNode = { name: "node-1", cpu: 4000, mem: 8192, usedCpu: 3500, usedMem: 2048 };
const n2: SchedNode = { name: "node-2", cpu: 4000, mem: 8192, usedCpu: 1000, usedMem: 6144 };
const n3: SchedNode = { name: "node-3", cpu: 2000, mem: 4096, usedCpu: 500, usedMem: 1024 };
const n4: SchedNode = { name: "node-4", cpu: 8000, mem: 16384, usedCpu: 0, usedMem: 0, taint: "gpu=true:NoSchedule" };
const pod = { cpu: 500, mem: 1024, tolerates: false };

describe("kube-scheduler port", () => {
  it("LeastAllocated: average free share after placing the Pod", () => {
    expect(leastAllocated(n2, pod)).toBe(37); // cpu (2500*100/4000)=62, mem (1024*100/8192)=12 → 74/2
    expect(leastAllocated(n3, pod)).toBe(50);
    expect(leastAllocated(n1, pod)).toBe(31); // cpu exactly full → 0, mem 62
  });

  it("BalancedAllocation: 75 when the balance doesn't change", () => {
    expect(balancedAllocation(n2, pod)).toBe(75); // std 0.25 before and after
    expect(balancedAllocation(n3, pod)).toBe(75); // std 0 before and after
    expect(balancedAllocation(n1, pod)).toBe(75);
    // A Pod that evens the node out scores above 75: node-2 is memory-heavy, a CPU-only Pod helps.
    expect(balancedAllocation(n2, { cpu: 2000, mem: 0, tolerates: false })).toBeGreaterThan(75);
  });

  it("filters: first failing plugin wins, fit allows an exact fill", () => {
    expect(filterNode(n1, pod).plugin).toBe(null); // 500 free, 500 asked
    expect(filterNode(n1, { ...pod, cpu: 600 }).reasons).toEqual(["Insufficient cpu"]);
    expect(filterNode(n4, pod).reasons).toEqual(["node(s) had untolerated taint(s)"]);
    expect(filterNode({ ...n4, unschedulable: true }, pod).plugin).toBe("NodeUnschedulable");
  });

  it("picks the highest total; a toleration opens the big node", () => {
    expect(schedule([n1, n2, n3, n4], pod).chosen).toBe("node-3"); // 125 vs 112, 106
    expect(schedule([n1, n2, n3, n4], { ...pod, tolerates: true }).chosen).toBe("node-4"); // 93 + 75
  });

  it("no node: the FitError message counts reasons", () => {
    const r = schedule([n1, n2, n3, n4], { cpu: 3100, mem: 1024, tolerates: false });
    expect(r.chosen).toBe(null);
    expect(r.message).toBe("0/4 nodes are available: 1 node(s) had untolerated taint(s), 3 Insufficient cpu.");
  });

  it("one feasible node is taken without scoring", () => {
    const r = schedule([n1, n2, n3, n4], { cpu: 2500, mem: 512, tolerates: false });
    expect(r.chosen).toBe("node-2");
    expect(r.nodes.every((x) => !x.scores)).toBe(true);
  });
});
