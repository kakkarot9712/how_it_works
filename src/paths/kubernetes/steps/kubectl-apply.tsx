import { Trace, type TraceSpec } from "@/components/path";
import { citer, Prose, simplifier, WriteupSection } from "@/components/writeup";
import { pickSources } from "@/lib/sources";
import { pool } from "../sources";

export const sources = pickSources(pool, [
  "components",
  "kubectl-apply",
  "controlling-access",
  "admission",
  "controllers",
  "api-concepts",
  "kcm-flags",
  "deployment",
  "replicaset",
  "pod-lifecycle",
  "scheduler",
  "sched-framework",
  "default-binder",
  "pod-api",
  "kubelet-config-src",
  "cri",
  "cri-proto",
  "cp-node",
  "virtual-ips",
]);
const cite = citer(sources);
const simplified = simplifier(sources);

// Sections are JSX constants in reading order, so the file's citation order is the page's.
const intro = (
  <WriteupSection id="setup" title="One manifest, five components">
    <p>
      A cluster has a control plane (<code>kube-apiserver</code>,{" "}
      <code>etcd</code>, <code>kube-scheduler</code>,{" "}
      <code>kube-controller-manager</code>) and nodes, each running a{" "}
      <code>kubelet</code> and a container runtime.{cite("components")} This
      trace follows one Deployment named <code>web</code> with one replica, from{" "}
      <code>kubectl apply</code> to a running container on <code>node-1</code>.
    </p>
    <p>
      Keep an eye on the <em>kube-apiserver</em> box: every component reads and
      writes cluster state through the API server, and none of them talk to each
      other directly. Step through with the arrows (or ← and →).
    </p>
  </WriteupSection>
);

export const trace: TraceSpec = {
  actors: [
    { id: "kubectl", label: "kubectl" },
    { id: "api", label: "kube-apiserver", sub: "+ etcd" },
    { id: "kcm", label: "controller-mgr", sub: "controllers" },
    { id: "sched", label: "kube-scheduler" },
    { id: "kubelet", label: "kubelet", sub: "node-1" },
  ],
  state: {
    fields: [
      { id: "deploy", label: "Deployment web stored", short: "Deployment" },
      { id: "rs", label: "ReplicaSet web-<hash> stored", short: "ReplicaSet" },
      { id: "pod", label: "Pod stored, and its spec.nodeName", short: "Pod" },
      { id: "phase", label: "Pod status.phase", short: "phase" },
      { id: "ctr", label: "What the node runs", short: "runs" },
    ],
    initial: {
      api: { deploy: "no", rs: "no", pod: "no", phase: "—" },
      kubelet: { ctr: "none" },
    },
  },
  hops: [
    {
      from: "kubectl",
      to: "api",
      label: "create Deployment",
      title: "kubectl sends the Deployment to the API server.",
      body: (
        <>
          <code>kubectl apply</code> creates the resource if it doesn&apos;t
          exist yet.{cite("kubectl-apply")} By default apply runs in the client
          (its field manager is <code>kubectl-client-side-apply</code>);{" "}
          <code>--server-side</code> moves it into the API server.
          {cite("kubectl-apply")} Either way, it is an ordinary request to the
          API server.
        </>
      ),
    },
    {
      from: "api",
      to: "api",
      label: "authn, authz, admission",
      title:
        "The API server checks who is asking, whether they may, and what the object may contain.",
      body: (
        <>
          Authentication fails with 401 and authorization with 403.
          {cite("controlling-access")} Then admission runs in two phases:
          mutating admission controllers first (they may change the object),
          then validating ones; any of them can reject the whole request.
          {cite("admission")} Finally the object is validated against its
          type&apos;s rules.{cite("controlling-access")} Despite the name,
          admission controllers are not the controllers you meet in hop 5: they
          are code inside the API server that intercepts a request before the
          object is stored,{cite("admission")} while controllers are separate
          loops that watch objects after they are stored.{cite("controllers")}
        </>
      ),
    },
    {
      from: "api",
      to: "api",
      label: "write to etcd",
      simplified: simplified(
        ["components"],
        <>
          <code>etcd</code> is drawn inside the API server&apos;s box. It is a
          separate store, usually a cluster of its own.
        </>,
      ),
      title: "The Deployment is stored. Nothing is running yet.",
      set: { api: { deploy: "yes" } },
      body: (
        <>
          After admission and validation the object is written to the object
          store,{cite("controlling-access")} which is <code>etcd</code>, the key
          value store for all API server data.{cite("components")} The
          Deployment is desired state: a record that one replica of{" "}
          <code>web</code> should exist.
        </>
      ),
    },
    {
      from: "api",
      to: "kubectl",
      label: "created",
      reply: true,
      title: "kubectl is done. The rest happens without it.",
      body: (
        <>
          The command returns as soon as the object is stored. Everything after
          this hop is the cluster reacting to the new object, driven by
          controllers that watch the API.{cite("controllers")}
        </>
      ),
    },
    {
      from: "api",
      to: "kcm",
      label: "watch: ADDED Deployment",
      simplified: simplified(
        ["api-concepts"],
        <>
          Watches are drawn as single events. A real controller keeps a
          long-lived watch open and handles many objects through it.
        </>,
      ),
      reply: true,
      title: "The Deployment controller hears about it through a watch.",
      body: (
        <>
          A watch is a stream of changes to objects, so clients don&apos;t poll;
          each event names its type, such as <code>ADDED</code> or{" "}
          <code>MODIFIED</code>.{cite("api-concepts")} Controllers are control
          loops that watch the cluster and move the current state toward the
          desired state.{cite("controllers")} The Deployment controller (
          <code>deployment-controller</code>) runs inside{" "}
          <code>kube-controller-manager</code>.{cite("kcm-flags")}
        </>
      ),
    },
    {
      from: "kcm",
      to: "api",
      label: "create ReplicaSet",
      simplified: simplified(
        ["deployment"],
        <>
          The status updates controllers write along the way, such as the
          Deployment&apos;s and ReplicaSet&apos;s replica counts, are left out.
        </>,
      ),
      title: "It doesn't start anything. It writes another object.",
      set: { api: { rs: "yes" } },
      body: (
        <>
          A Deployment creates a ReplicaSet, named after the Deployment plus the{" "}
          <code>pod-template-hash</code> of its Pod template.
          {cite("deployment")} The new object goes through the same checks and
          is stored like the first. Built-in controllers act by telling the API
          server to create or remove objects.{cite("controllers")}
        </>
      ),
    },
    {
      from: "api",
      to: "kcm",
      label: "watch: ADDED ReplicaSet",
      reply: true,
      title: "The ReplicaSet controller sees the new ReplicaSet.",
      body: (
        <>
          A different control loop, <code>replicaset-controller</code>, in the
          same process.{cite("kcm-flags")} It compares the ReplicaSet&apos;s
          desired count of Pods with the Pods it owns: one wanted, none exist.
          {cite("replicaset")}
        </>
      ),
    },
    {
      from: "kcm",
      to: "api",
      label: "create Pod",
      simplified: simplified(
        ["replicaset"],
        <>
          One replica on one node. With more replicas the ReplicaSet controller
          creates several Pods, and the scheduler binds each one separately.
        </>,
      ),
      title: "It creates one Pod from the template. The Pod has no node.",
      set: { api: { pod: "no node", phase: "Pending" } },
      body: (
        <>
          A ReplicaSet creates Pods from its Pod template and links each one to
          itself through the Pod&apos;s <code>ownerReferences</code>.
          {cite("replicaset")} The Pod is <code>Pending</code>: accepted by the
          cluster, with containers not yet set up, which includes the time it
          waits to be scheduled.{cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "api",
      to: "sched",
      label: "watch: ADDED Pod",
      reply: true,
      title: "The scheduler sees a Pod that is not bound to a node.",
      body: (
        <>
          <code>kube-scheduler</code> looks for Pods not yet bound to a node and
          assigns each one to a suitable node.{cite("components")}
        </>
      ),
    },
    {
      from: "sched",
      to: "sched",
      label: "filter, score",
      title:
        "It filters out nodes that can't run the Pod, then scores the rest.",
      body: (
        <>
          Filtering finds the nodes where the Pod fits, for example with enough
          free resources for its requests; scoring ranks those, and the
          scheduler picks the highest.{cite("scheduler")} These run as{" "}
          <code>Filter</code> and <code>Score</code> plugins in the scheduling
          cycle.{cite("sched-framework")} Here it picks <code>node-1</code>.
        </>
      ),
    },
    {
      from: "sched",
      to: "api",
      label: "Binding(node-1)",
      title: "The scheduler writes its decision back: binding.",
      set: { api: { pod: "node-1" } },
      body: (
        <>
          The scheduler notifies the API server of its choice, a step called
          binding,{cite("scheduler")} in the binding cycle.
          {cite("sched-framework")} The default <code>Bind</code> plugin sends a{" "}
          <code>Binding</code> object, and the API server sets the Pod&apos;s{" "}
          <code>spec.nodeName</code>, refusing if it is already set.
          {cite("default-binder")} The scheduler starts nothing on the node
          either.
        </>
      ),
    },
    {
      from: "api",
      to: "kubelet",
      label: "watch: Pod for node-1",
      reply: true,
      title: "node-1's kubelet sees a Pod assigned to it.",
      body: (
        <>
          Once <code>nodeName</code> is set, the kubelet on that node becomes
          responsible for the Pod.{cite("pod-api")} The kubelet watches Pods
          with a field selector on <code>spec.nodeName</code> equal to its own
          node name, so it only hears about its own.{cite("kubelet-config-src")}
        </>
      ),
    },
    {
      from: "kubelet",
      to: "kubelet",
      label: "CRI: RunPodSandbox…",
      title:
        "The kubelet asks the container runtime, over CRI, to start the Pod.",
      set: { kubelet: { ctr: "web pod" } },
      body: (
        <>
          The kubelet is a gRPC client of the container runtime through the
          Container Runtime Interface.{cite("cri")} The calls are{" "}
          <code>RunPodSandbox</code> (a pod-level sandbox),{" "}
          <code>PullImage</code> if the image is missing,{" "}
          <code>CreateContainer</code> and <code>StartContainer</code>.
          {cite("cri-proto")}
        </>
      ),
    },
    {
      from: "kubelet",
      to: "api",
      label: "PATCH pods/status",
      title: "The kubelet reports back: the Pod is Running.",
      set: { api: { phase: "Running" } },
      body: (
        <>
          The kubelet writes the Pod&apos;s status through the status
          subresource,{cite("pod-api")} with a patch from its status manager.
          {cite("kubelet-config-src")} A Pod is <code>Running</code> once it is
          bound to a node, all its containers have been created, and at least
          one is running.{cite("pod-lifecycle")}
        </>
      ),
    },
  ],
};

const after = (
  <>
    <WriteupSection id="takeaways" title="What to take away">
      <ul>
        <li>
          <strong>Every component talks only to the API server.</strong> The
          controllers, the scheduler and the kubelet each watch for objects and
          write objects back; none of them calls another.
          {cite("controllers", "components")}
        </li>
        <li>
          <strong>Each step is a write that triggers the next watcher.</strong>{" "}
          Deployment → ReplicaSet → Pod → binding → status: four control loops,
          each doing one small thing.
          {cite("deployment", "replicaset", "scheduler")}
        </li>
        <li>
          <strong>
            <code>kubectl apply</code> only records intent.
          </strong>{" "}
          It returns once the Deployment is stored; the Pod being{" "}
          <code>Pending</code> or <code>Running</code> is decided later, by
          other components.{cite("pod-lifecycle")}
        </li>
      </ul>
    </WriteupSection>

    <WriteupSection id="what-if" title="What if…">
      <p>
        <strong>
          …the API server needs something from a node? Does it ever call the
          kubelet?
        </strong>{" "}
        Yes, but not to run Pods. Kubernetes uses a hub-and-spoke pattern: all
        API usage from nodes ends at the API server.{cite("cp-node")} In the
        other direction there are two paths: the API server to the kubelet, used
        for fetching Pod logs, attaching to running Pods and port-forwarding,
        and the API server&apos;s proxy to nodes, Pods and Services.
        {cite("cp-node")} Starting a Pod is never one of them: as hop 12 shows,
        the kubelet finds its Pods through its own watch.
        {cite("kubelet-config-src")}
      </p>
      <p>
        <strong>…an admission controller rejects the Deployment?</strong> If any
        admission controller in either phase rejects it, the whole request is
        rejected at once and kubectl gets the error.{cite("admission")} The
        write to the object store comes only after admission and validation,
        {cite("controlling-access")} so nothing is stored and no controller ever
        hears of it.
      </p>
      <p>
        <strong>…you delete the Pod by hand?</strong> A new one appears. The
        ReplicaSet creates and deletes Pods as needed to reach its desired
        number,{cite("replicaset")} so its controller sees one Pod missing and
        creates a replacement, which the scheduler binds again, possibly to a
        different node. To get rid of the Pod for good, change the
        Deployment&apos;s <code>replicas</code>.{cite("deployment")}
      </p>
      <p>
        <strong>…the scheduler finds no node?</strong> If no node passes
        filtering, the Pod isn&apos;t schedulable yet{cite("scheduler")} and
        stays <code>Pending</code>, which includes the time a Pod waits to be
        scheduled.{cite("pod-lifecycle")}
      </p>
      <p>
        <strong>…the image can&apos;t be pulled?</strong> The Pod is bound but
        stays <code>Pending</code>: that phase also covers the time spent
        downloading container images, and it becomes <code>Running</code> only
        once all its containers have been created.{cite("pod-lifecycle")}
      </p>
      <p>
        <strong>
          …a client sends traffic to the Pod through a Service? Does it pass
          through kube-proxy?
        </strong>{" "}
        No. kube-proxy is optional and maintains network rules on the node.
        {cite("components")} Each kube-proxy watches the control plane for
        Service and EndpointSlice objects and configures the node to capture
        traffic to a Service&apos;s <code>clusterIP</code> and redirect it to
        one of its endpoints; in 1.37 the default mode does this with{" "}
        <code>iptables</code>.{cite("virtual-ips")} The packets are handled by
        those rules, not by the kube-proxy process.
      </p>
    </WriteupSection>
  </>
);

/** Trace: `kubectl apply` of a one-replica Deployment, from the API server to a running container. */
export function Body() {
  return (
    <Prose>
      {intro}
      <Trace spec={trace} title="Deployment web · replicas: 1 · node-1" />
      {after}
    </Prose>
  );
}
