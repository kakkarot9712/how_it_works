import { citer, Prose, simplifier, WriteupSection } from "@/components/writeup";
import { pickSources } from "@/lib/sources";
import { pool } from "../sources";
import { NodePicker } from "../widgets/NodePicker";

export const sources = pickSources(pool, [
  "scheduler",
  "resources",
  "taints",
  "cordon",
  "sched-framework",
  "sched-plugins-src",
  "sched-select-src",
  "default-binder",
]);
const cite = citer(sources);
const simplified = simplifier(sources);

const intro = (
  <WriteupSection id="setup" title="Two passes over the nodes">
    <p>
      For each Pod that has no node yet, kube-scheduler works in two passes.
      First it <strong>filters</strong>: it throws out every node where the Pod
      can&apos;t run at all. Then it <strong>scores</strong> the nodes that are
      left and picks the one with the highest score.{cite("scheduler")} A filter
      is a yes or no; a score only ranks the nodes that already said yes.
    </p>
  </WriteupSection>
);

const rules = (
  <WriteupSection id="rules" title="What can rule a node out">
    <p>
      Three things decide whether a node passes the filters here. Each one has
      its own word, and you&apos;ll set all three in the widget below.
    </p>
    <p>
      <strong>Resource requests: what the Pod says it needs.</strong> Each
      container declares how much CPU and memory it asks for. CPU is counted in
      millicores: <code>500m</code> is half a core. The scheduler adds up the
      resource requests of the Pods already on a node and places a new Pod only
      where its requests still fit in what the node can provide. It goes by
      these declared numbers, not by actual usage: it refuses a node that fails
      the check even if that node is nearly idle.{cite("resources")}
    </p>
    <p>
      <strong>
        Taints and tolerations: a lock on the node, a key on the Pod.
      </strong>{" "}
      A taint is a mark you put on a node, such as{" "}
      <code>gpu=true:NoSchedule</code>, that repels Pods. A toleration is the
      matching setting on a Pod that lets it past that taint. A toleration only{" "}
      <em>allows</em> the node; it doesn&apos;t send the Pod there, because the
      scheduler still weighs everything else.{cite("taints")}
    </p>
    <p>
      <strong>Cordon: &ldquo;no new Pods here&rdquo;.</strong> To cordon a node
      is to mark it unschedulable, which is what <code>kubectl cordon</code>{" "}
      does, for example before maintenance. The scheduler then places no new
      Pods on it.{cite("cordon")}
    </p>
  </WriteupSection>
);

const widget = (
  <WriteupSection id="try" title="Pick a node">
    <p>
      The scheduler is built from plugins: small pieces of code, each run at
      fixed places in its work called extension points, such as Filter and
      Score.{cite("sched-framework")} The widget runs a port of the default
      plugins that matter for a simple Pod. Filters run in the default order:{" "}
      <code>NodeUnschedulable</code>, <code>TaintToleration</code>,{" "}
      <code>NodeResourcesFit</code>; the first one to reject a node ends its
      check.{cite("sched-framework", "sched-plugins-src")} Two scorers rank the
      rest: <code>NodeResourcesFit</code> with its default{" "}
      <code>LeastAllocated</code> strategy, and{" "}
      <code>NodeResourcesBalancedAllocation</code>, both with weight 1.
      {cite("sched-plugins-src")}
    </p>
    <NodePicker />
    {simplified(
      ["sched-plugins-src", "resources"],
      <>
        Only CPU and memory, one taint and a cordon. The default profile has
        more filters (node affinity, ports, volumes, topology spread) and more
        scorers (<code>TaintToleration</code>, <code>NodeAffinity</code>,{" "}
        <code>PodTopologySpread</code>, <code>InterPodAffinity</code>,{" "}
        <code>ImageLocality</code>); the widget leaves them out, as if they gave
        every node the same score. Each node&apos;s requests are a fixed sum;
        the real scheduler adds up the requests of each Pod&apos;s containers.
      </>,
    )}
    <p>Things to try:</p>
    <ul>
      <li>
        Raise the CPU request to 600m. node-1 had exactly 500m left, so it drops
        out with <code>Insufficient cpu</code>; at 500m it fits, because a
        request may fill a node exactly.{cite("sched-plugins-src")}
      </li>
      <li>
        Tick the toleration. node-4 passes the filter and wins on score, being
        empty. It lands there only because node-4 scores best: the toleration
        just let it in.{cite("taints")}
      </li>
      <li>
        Cordon node-3. It is now unschedulable,{cite("cordon")} and the first
        filter rejects it.
      </li>
      <li>
        Ask for 3100m of CPU. No node fits, and the Pod stays{" "}
        <code>Pending</code> with the scheduler&apos;s message: how many nodes
        there are and how many failed for each reason.{cite("sched-select-src")}
      </li>
    </ul>
  </WriteupSection>
);

const scores = (
  <WriteupSection id="scores" title="How the two scores work">
    <p>
      <strong>LeastAllocated</strong> favours free space. For CPU and memory it
      computes the share left free after placing the Pod, on a 0 to 100 scale,
      and averages them. A resource asked beyond capacity scores 0.
      {cite("sched-plugins-src")} So it spreads Pods onto emptier nodes.
    </p>
    <p>
      <strong>BalancedAllocation</strong> favours even use: it penalises a node
      whose CPU and memory are used in very different proportions. In 1.37 it
      scores the <em>change</em> the Pod makes: 75 when the balance stays the
      same, toward 100 when the Pod evens the node out, toward 50 when it skews
      it.{cite("sched-plugins-src")} Try a CPU-heavy Pod with little memory:
      node-2, which is mostly full of memory, gets a higher balance score.
    </p>
    <p>
      Each plugin&apos;s score is multiplied by its weight and the results are
      summed.{cite("sched-framework")} The highest total wins; on a tie, the
      scheduler picks one of the tied nodes at random. If only one node passes
      the filters, scoring is skipped.{cite("sched-select-src")}
    </p>
  </WriteupSection>
);

const after = (
  <>
    <WriteupSection id="takeaways" title="What to take away">
      <ul>
        <li>
          <strong>Requests decide, not usage.</strong> A node is full when its
          Pods&apos; requests add up to its capacity, however idle it is.
          {cite("resources")}
        </li>
        <li>
          <strong>Filters exclude, scores rank.</strong> A rejected node is
          never scored, and a toleration only lifts a filter.
          {cite("scheduler", "taints")}
        </li>
        <li>
          <strong>The default spreads Pods out.</strong>{" "}
          <code>LeastAllocated</code> prefers emptier nodes; the alternative,{" "}
          <code>MostAllocated</code>, packs them.{cite("sched-plugins-src")}
        </li>
      </ul>
    </WriteupSection>

    <WriteupSection id="what-if" title="What if…">
      <p>
        <strong>…a Pod sets no requests at all?</strong> For filtering it asks
        for nothing, so it fits anywhere with room. For scoring, the resource
        scorers count such a Pod as 100m of CPU and 200 MB of memory, so empty
        requests don&apos;t make every node look idle.
        {cite("sched-plugins-src")}
      </p>
      <p>
        <strong>
          …two schedulers, or two scheduling attempts, pick the same node for
          the same Pod?
        </strong>{" "}
        Only one binding wins: the API server refuses to bind a Pod whose{" "}
        <code>spec.nodeName</code> is already set.{cite("default-binder")}
      </p>
      <p>
        <strong>…the node fills up while the binding is in flight?</strong>{" "}
        Before binding, a Reserve phase holds the node&apos;s resources for the
        Pod; it exists to prevent race conditions while the scheduler waits for
        the bind to succeed.{cite("sched-framework")}
      </p>
    </WriteupSection>
  </>
);

/** Explore: kube-scheduler's filters and resource scores on four nodes, with a ported scorer. */
export function Body() {
  return (
    <Prose>
      {intro}
      {rules}
      {widget}
      {scores}
      {after}
    </Prose>
  );
}
