/**
 * A port of the parts of kube-scheduler (v1.37.2) that decide where a simple Pod goes:
 * the NodeUnschedulable, TaintToleration and NodeResourcesFit filters, and the two
 * resource scorers, NodeResourcesFit (LeastAllocated, the default strategy, CPU and memory
 * weight 1) and NodeResourcesBalancedAllocation, each with plugin weight 1. Integer maths
 * follows the Go code: int64 division truncates, float scores are truncated by int64().
 * Sources: pkg/scheduler/framework/plugins/noderesources/{fit,least_allocated,balanced_allocation}.go,
 * tainttoleration/taint_toleration.go, nodeunschedulable/node_unschedulable.go,
 * apis/config/v1/default_plugins.go, framework/runtime/framework.go, framework/types.go.
 */

export const MAX_NODE_SCORE = 100;

export interface SchedNode {
  name: string;
  /** Allocatable CPU, millicores. */
  cpu: number;
  /** Allocatable memory, MiB. */
  mem: number;
  /** Sum of the requests of Pods already on the node. */
  usedCpu: number;
  usedMem: number;
  /** A NoSchedule taint, shown as `key=value:NoSchedule`. */
  taint?: string;
  /** Cordoned (`spec.unschedulable`). */
  unschedulable?: boolean;
}

export interface SchedPod {
  cpu: number;
  mem: number;
  /** Tolerates every node's taint in this widget (a single taint exists). */
  tolerates: boolean;
}

export interface FilterResult {
  /** The plugin that rejected the node, or null if it passed every filter. */
  plugin: "NodeUnschedulable" | "TaintToleration" | "NodeResourcesFit" | null;
  /** The plugin's reasons, verbatim from the source. */
  reasons: string[];
}

/** Filters run in the default plugin order, and the first failure stops the rest for that node. */
export function filterNode(n: SchedNode, p: SchedPod): FilterResult {
  if (n.unschedulable) return { plugin: "NodeUnschedulable", reasons: ["node(s) were unschedulable"] };
  if (n.taint && !p.tolerates) return { plugin: "TaintToleration", reasons: ["node(s) had untolerated taint(s)"] };
  const reasons: string[] = [];
  if (p.cpu > 0 && p.cpu > n.cpu - n.usedCpu) reasons.push("Insufficient cpu");
  if (p.mem > 0 && p.mem > n.mem - n.usedMem) reasons.push("Insufficient memory");
  return reasons.length ? { plugin: "NodeResourcesFit", reasons } : { plugin: null, reasons: [] };
}

const div = (a: number, b: number) => Math.trunc(a / b); // Go int64 division

function leastRequestedScore(requested: number, capacity: number): number {
  if (capacity === 0 || requested > capacity) return 0;
  return div((capacity - requested) * MAX_NODE_SCORE, capacity);
}

/** NodeResourcesFit score, LeastAllocated: the average share of each resource left free, 0 to 100. */
export function leastAllocated(n: SchedNode, p: SchedPod): number {
  const cpu = leastRequestedScore(n.usedCpu + p.cpu, n.cpu);
  const mem = leastRequestedScore(n.usedMem + p.mem, n.mem);
  return div(cpu * 1 + mem * 1, 2);
}

function balancedResourceScore(cpuReq: number, memReq: number, n: SchedNode): number {
  const f1 = Math.min(cpuReq / n.cpu, 1);
  const f2 = Math.min(memReq / n.mem, 1);
  const std = Math.abs((f1 - f2) / 2);
  return Math.trunc((1 - std) * MAX_NODE_SCORE);
}

/** NodeResourcesBalancedAllocation: how much placing the Pod improves the balance of CPU and memory use, 50 to 100. */
export function balancedAllocation(n: SchedNode, p: SchedPod): number {
  const withPod = balancedResourceScore(n.usedCpu + p.cpu, n.usedMem + p.mem, n);
  const without = balancedResourceScore(n.usedCpu, n.usedMem, n);
  return MAX_NODE_SCORE / 2 + div(MAX_NODE_SCORE / 2 + withPod - without, 2);
}

export interface NodeResult {
  node: SchedNode;
  filter: FilterResult;
  /** Only for feasible nodes, and only when there are at least two of them (one feasible node is taken without scoring). */
  scores?: { least: number; balanced: number; total: number };
}

export interface ScheduleResult {
  nodes: NodeResult[];
  /** The chosen node, or null if none fits. */
  chosen: string | null;
  /** Nodes tied on the top total: the scheduler picks among them at random. */
  tied: string[];
  /** The FitError message when nothing fits: "0/N nodes are available: …." */
  message: string | null;
}

export function schedule(nodes: SchedNode[], pod: SchedPod): ScheduleResult {
  const results: NodeResult[] = nodes.map((node) => ({ node, filter: filterNode(node, pod) }));
  const feasible = results.filter((r) => r.filter.plugin === null);
  if (feasible.length === 0) {
    const hist = new Map<string, number>();
    for (const r of results) for (const reason of r.filter.reasons) hist.set(reason, (hist.get(reason) ?? 0) + 1);
    const parts = [...hist].map(([reason, count]) => `${count} ${reason}`).sort();
    return { nodes: results, chosen: null, tied: [], message: `0/${nodes.length} nodes are available: ${parts.join(", ")}.` };
  }
  if (feasible.length === 1) return { nodes: results, chosen: feasible[0].node.name, tied: [], message: null };
  for (const r of feasible) {
    const least = leastAllocated(r.node, pod);
    const balanced = balancedAllocation(r.node, pod);
    r.scores = { least, balanced, total: least * 1 + balanced * 1 };
  }
  const top = Math.max(...feasible.map((r) => r.scores!.total));
  const tied = feasible.filter((r) => r.scores!.total === top).map((r) => r.node.name);
  return { nodes: results, chosen: tied[0], tied: tied.length > 1 ? tied : [], message: null };
}
