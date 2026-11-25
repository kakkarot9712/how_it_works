/**
 * Concept terms: the words a learning path teaches (taint, partition, controller…), as
 * opposed to acronyms (TCP, ISR), which live in glossary.ts. Both are one dictionary:
 * glossary.ts merges these into GLOSSARY, so hover tooltips, the "New words in this step"
 * box and each path's Terms page all read the same entry.
 *
 * One entry per idea, shared by every system that uses it. A term used by several paths
 * (leader, heartbeat, controller, replica) has one `taught` row per path, with a `note` on
 * what it means in that system, so a reader hovering it in one path sees the link to the
 * other. Rules (the `define-terms` skill), enforced by src/paths/paths.test.ts:
 *   - `taught.step` is the first step of that path whose text uses the term;
 *   - `taught.ref` is a reference id in that path's source pool (the fact behind the brief);
 *   - a step may not use a concept term whose entry has no `taught` row for its path.
 * Keys: lowercase for ordinary words (also matched capitalized at a sentence start), exact
 * case for proper names (Pod, ReplicaSet). A trailing "s" plural always matches; other
 * forms (rebalancing, tainted) go in `forms`.
 */
import type { GlossaryEntry } from "./glossary";

export const CONCEPTS: Record<string, GlossaryEntry> = {
  // ── Shared across systems ──────────────────────────────────────────────────────────
  leader: {
    brief: "The one copy that takes the writes and decides their order; the other copies replicate from it. If it fails, another is chosen.",
    taught: [{ path: "kafka", step: "topics-and-partitions", ref: "design", note: "Each partition has one leader broker. All writes go to it." }],
  },
  follower: {
    brief: "A copy that replicates from the leader instead of taking writes itself, so it can take over if the leader fails.",
    taught: [{ path: "kafka", step: "one-record", ref: "design", note: "Followers pull from the leader with Fetch requests, as a consumer would." }],
  },
  replica: {
    brief: "One of several identical copies kept so the system survives a failure: a copy of some data, or of a running program.",
    taught: [
      { path: "kafka", step: "one-record", ref: "design", note: "A copy of one partition's log, on its own broker." },
      { path: "kubernetes", step: "kubectl-apply", ref: "deployment", note: "A copy of a Pod. A Deployment's replicas field says how many should run." },
    ],
  },
  heartbeat: {
    brief: "A small \"I'm alive\" message sent on a timer. If heartbeats stop for longer than a timeout, the receiver treats the sender as dead.",
    taught: [
      {
        path: "kafka",
        step: "replication-lab",
        ref: "design",
        note: "Brokers heartbeat the controller; consumers heartbeat their group coordinator.",
      },
    ],
  },
  controller: {
    brief: "A component that watches part of a system and acts to keep it in the intended shape. Kafka and Kubernetes both use the word, for different things.",
    taught: [
      { path: "kafka", step: "replication-lab", ref: "design", note: "The cluster's controller tracks which brokers are alive and elects partition leaders." },
      {
        path: "kubernetes",
        step: "kubectl-apply",
        ref: "controllers",
        note: "A control loop, like a thermostat: it watches objects and writes changes to move the cluster toward the desired state.",
      },
    ],
  },
  "consumer group": {
    brief: "Consumers that share the work of reading one stream: each piece of it goes to exactly one member, and each group reads the whole stream.",
    taught: [{ path: "kafka", step: "topics-and-partitions", ref: "consumer-javadoc", note: "Each partition is read by exactly one member of the group." }],
  },
  "at-least-once": {
    brief: "A delivery guarantee: nothing is lost, but after a failure some messages may be processed twice.",
    taught: [{ path: "kafka", step: "consume-and-commit", ref: "design", note: "Process, then commit the offset. A crash in between replays the batch." }],
  },
  "at-most-once": {
    brief: "A delivery guarantee: nothing is processed twice, but after a failure some messages may be lost.",
    taught: [{ path: "kafka", step: "consume-and-commit", ref: "design", note: "Commit the offset, then process. A crash in between skips the batch." }],
  },
  "long poll": {
    brief: "A request the server holds open until it has data or a timeout passes, so the client gets new data at once without asking again and again.",
    taught: [{ path: "kafka", step: "consume-and-commit", ref: "design", note: "A Fetch waits at the broker until data arrives." }],
  },
  "desired state": {
    brief: "What you asked for, as opposed to what exists right now. A control loop keeps comparing the two and acting to close the gap.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "controllers", note: "An object's spec. Controllers work to make the cluster match it." }],
  },
  "optimistic concurrency": {
    brief: "Write only if nothing changed since you read: each write names the version it was based on, and a stale one is rejected instead of overwriting.",
    taught: [{ path: "kubernetes", step: "objects-and-watches", ref: "api-concepts", note: "A PUT carries the resourceVersion it read; a stale one gets 409 Conflict." }],
  },
  "exponential back-off": {
    brief: "Waiting longer after each failure before trying again, doubling the delay up to a cap, so a failing thing isn't retried in a tight loop.",
    taught: [{ path: "kubernetes", step: "kubelet-and-cri", ref: "pod-lifecycle", note: "The kubelet restarts a crashing container after 10 s, 20 s, 40 s…, capped at 5 minutes." }],
  },
  "virtual IP": {
    brief: "An IP address that no machine owns. Packets sent to it are rewritten to a real address on the way.",
    taught: [{ path: "kubernetes", step: "services", ref: "virtual-ips", note: "A Service's cluster IP, which each node's rules rewrite to a Pod's IP." }],
  },
  node: {
    brief: "One machine, physical or virtual, in a cluster.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "components", note: "It runs a kubelet and a container runtime; Pods are scheduled onto it." }],
  },
  "session affinity": {
    brief: "Sending the same client to the same backend each time, instead of picking a backend per connection.",
    taught: [{ path: "kubernetes", step: "services", ref: "virtual-ips" }],
  },

  // ── Kafka ──────────────────────────────────────────────────────────────────────────
  topic: {
    brief: "A named stream of records in Kafka, split into partitions that live on different brokers.",
    taught: [{ path: "kafka", step: "topics-and-partitions", ref: "intro" }],
  },
  partition: {
    brief: "One ordered, append-only log that is part of a topic. Order holds within a partition, never across partitions.",
    taught: [{ path: "kafka", step: "topics-and-partitions", ref: "intro" }],
  },
  offset: {
    brief: "A record's position in its partition: 0, 1, 2… Offsets only grow, and are unique within one partition.",
    taught: [{ path: "kafka", step: "topics-and-partitions", ref: "log-impl" }],
  },
  broker: {
    brief: "A Kafka server. It stores replicas of some partitions and serves the producers and consumers that use them.",
    taught: [{ path: "kafka", step: "topics-and-partitions", ref: "intro" }],
  },
  partitioner: {
    brief: "The producer code that picks each record's partition. By default it hashes the record's key, modulo the number of partitions.",
    taught: [{ path: "kafka", step: "topics-and-partitions", ref: "partitioner-java" }],
  },
  "group coordinator": {
    brief: "The broker that manages one consumer group: its members, which partitions each one owns, and the offsets it has committed.",
    taught: [{ path: "kafka", step: "consume-and-commit", ref: "kip-848" }],
  },
  "committed offset": {
    brief: "The offset a consumer group has saved for a partition: where a member starts reading after a restart or a rebalance.",
    taught: [{ path: "kafka", step: "consume-and-commit", ref: "consumer-javadoc" }],
  },
  Produce: {
    brief: "The Kafka request a producer sends to a partition's leader to write records. Its acks setting decides when the leader answers.",
    taught: [{ path: "kafka", step: "one-record", ref: "protocol" }],
  },
  Fetch: {
    brief: "The Kafka request that reads records from a partition, starting at a given offset. Consumers and follower replicas both use it.",
    taught: [{ path: "kafka", step: "one-record", ref: "protocol" }],
  },
  "consumer position": {
    brief: "A Kafka consumer's place in a partition: the offset of the next record it will read. It moves on as poll() returns records.",
    taught: [{ path: "kafka", step: "one-record", ref: "design" }],
  },
  rebalance: {
    brief: "Dividing a consumer group's partitions among its members again, when a member joins, leaves or crashes, or partitions are added.",
    forms: ["rebalancing", "rebalanced"],
    taught: [{ path: "kafka", step: "consume-and-commit", ref: "consumer-javadoc" }],
  },

  // ── Kubernetes ─────────────────────────────────────────────────────────────────────
  Pod: {
    brief: "The smallest unit Kubernetes runs: one or more containers with shared storage and network, always placed on the same node together.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "pods" }],
  },
  Deployment: {
    brief: "An object that declares how many copies of a Pod should run and how to roll out changes. It manages ReplicaSets to do it.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "deployment" }],
  },
  ReplicaSet: {
    brief: "An object that keeps a set number of identical Pods running, creating or deleting Pods to match. Deployments create them.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "replicaset" }],
  },
  Service: {
    brief: "A stable name and virtual IP in front of a changing set of Pods, picked by a label selector.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "service" }],
  },
  EndpointSlice: {
    brief: "A list of the addresses of the Pods behind a Service, with whether each one is ready to receive traffic.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "endpointslices" }],
  },
  "control plane": {
    brief: "The components that manage a Kubernetes cluster (API server, etcd, scheduler, controller manager), as opposed to the nodes that run workloads.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "components" }],
  },
  "API server": {
    brief: "kube-apiserver: it serves the Kubernetes API, and every other component reads and writes cluster state through it.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "cp-node" }],
  },
  scheduler: {
    brief: "kube-scheduler: it picks a node for each Pod that has none (filter, then score) and records the choice as a binding.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "scheduler" }],
  },
  kubelet: {
    brief: "The agent on each node. It runs the Pods bound to that node through the container runtime, probes them and reports their status.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "components" }],
  },
  "container runtime": {
    brief: "The software on each node that actually runs containers. The kubelet tells it what to do over CRI.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "cri" }],
  },
  "admission controller": {
    brief: "Code inside the API server that checks, and may change, a request before the object is stored. Not a controller in the control-loop sense.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "admission" }],
  },
  manifest: {
    brief: "A file describing the objects you want, in YAML or JSON. kubectl apply sends it to the API server.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "kubectl-apply" }],
  },
  binding: {
    brief: "The scheduler's decision, written to the API server: this Pod runs on that node. It sets the Pod's nodeName.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "default-binder" }],
  },
  watch: {
    brief: "A long-lived request to the Kubernetes API that streams every change to the objects it asks about, so clients never need to poll.",
    forms: ["watches"],
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "api-concepts" }],
  },
  "watch cache": {
    brief: "The API server's in-memory mirror of the data in etcd. Many reads are served from it, which takes load off etcd.",
    taught: [{ path: "kubernetes", step: "objects-and-watches", ref: "api-concepts" }],
  },
  namespace: {
    brief: "A named group of objects inside one cluster. Names only need to be unique within their namespace.",
    taught: [{ path: "kubernetes", step: "objects-and-watches", ref: "api-concepts" }],
  },
  "extension point": {
    brief: "A fixed place in a program's work where plugins can hook in. kube-scheduler's include Filter (can this node run the Pod?) and Score (how good is it?).",
    taught: [{ path: "kubernetes", step: "filter-and-score", ref: "sched-framework" }],
  },
  Reserve: {
    brief: "A kube-scheduler extension point that holds a node's resources for a Pod before the binding is written, so no other Pod takes them meanwhile.",
    taught: [{ path: "kubernetes", step: "filter-and-score", ref: "sched-framework" }],
  },
  LeastAllocated: {
    brief: "The default resource score: the share of CPU and memory a node would have left after the Pod, 0 to 100. Spreads Pods onto emptier nodes.",
    taught: [{ path: "kubernetes", step: "filter-and-score", ref: "sched-plugins-src" }],
  },
  BalancedAllocation: {
    brief: "A resource score that favours nodes whose CPU and memory stay used in similar proportions once the Pod is added.",
    taught: [{ path: "kubernetes", step: "filter-and-score", ref: "sched-plugins-src" }],
  },
  Job: {
    brief: "A Kubernetes object that runs one or more Pods to carry out a task and then stop.",
    taught: [{ path: "kubernetes", step: "objects-and-watches", ref: "controllers" }],
  },
  Reflector: {
    brief: "The part of Kubernetes' Go client library that runs list-then-watch for a program and keeps its local copy of the objects current.",
    taught: [{ path: "kubernetes", step: "objects-and-watches", ref: "api-concepts" }],
  },
  NodePort: {
    brief: "A Service type that also opens the Service on every node's IP at a fixed port, so traffic from outside the cluster can reach it.",
    taught: [{ path: "kubernetes", step: "services", ref: "service" }],
  },
  Pending: {
    brief: "A Pod phase: accepted by the cluster, but its containers aren't set up yet. It covers waiting to be scheduled and pulling images.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "pod-lifecycle" }],
  },
  Running: {
    brief: "A Pod phase: bound to a node, all containers created, at least one running or (re)starting. It says nothing about being Ready.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "pod-lifecycle" }],
  },
  Ready: {
    brief: "A Pod condition: true when the Pod can serve requests and should get traffic from its Services. Separate from the phase.",
    taught: [{ path: "kubernetes", step: "kubelet-and-cri", ref: "pod-lifecycle" }],
  },
  Waiting: {
    brief: "A container state: not started yet, still doing what it needs first, such as pulling its image.",
    taught: [{ path: "kubernetes", step: "kubelet-and-cri", ref: "pod-lifecycle" }],
  },
  CrashLoopBackOff: {
    brief: "What kubectl shows while the kubelet waits out a back-off before restarting a crashing container. A display status, not a Pod phase.",
    taught: [{ path: "kubernetes", step: "kubelet-and-cri", ref: "pod-lifecycle" }],
  },
  "resource request": {
    brief: "How much CPU and memory a container asks for. The scheduler places Pods by their requests, not by how much they actually use.",
    taught: [{ path: "kubernetes", step: "filter-and-score", ref: "resources" }],
  },
  taint: {
    brief: "A mark on a node that repels Pods: only Pods with a matching toleration may be scheduled there.",
    forms: ["tainted"],
    taught: [{ path: "kubernetes", step: "filter-and-score", ref: "taints" }],
  },
  toleration: {
    brief: "A setting on a Pod that lets it be scheduled onto nodes with a matching taint. It allows the node; it doesn't send the Pod there.",
    taught: [{ path: "kubernetes", step: "filter-and-score", ref: "taints" }],
  },
  cordon: {
    brief: "Marking a node unschedulable, as kubectl cordon does, so the scheduler places no new Pods on it.",
    forms: ["cordoned", "cordoning"],
    taught: [{ path: "kubernetes", step: "filter-and-score", ref: "cordon" }],
  },
  sandbox: {
    brief: "The environment a Pod's containers share on a node, such as its network. The container runtime sets it up before any container starts.",
    taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "cri-proto" }],
  },
  "readiness probe": {
    brief: "A check the kubelet runs to decide whether a container can take traffic. Failing it takes the Pod out of its Services, without a restart.",
    taught: [{ path: "kubernetes", step: "kubelet-and-cri", ref: "pod-lifecycle" }],
  },
  "liveness probe": {
    brief: "A check the kubelet runs to see whether a container still works. Failing it more often than allowed gets the container restarted.",
    taught: [{ path: "kubernetes", step: "kubelet-and-cri", ref: "pod-lifecycle" }],
  },
  "startup probe": {
    brief: "A check that holds back the liveness and readiness probes until the app has started, so a slow start isn't mistaken for a hang.",
    taught: [{ path: "kubernetes", step: "kubelet-and-cri", ref: "pod-lifecycle" }],
  },
  "cluster IP": {
    brief: "The virtual IP a Kubernetes Service gets. No machine has it; each node's rules rewrite it to the IP of one of the Service's Pods.",
    taught: [{ path: "kubernetes", step: "services", ref: "service" }],
  },
  "label selector": {
    brief: "A query on labels (key=value tags on objects), such as app=web, that picks a set of objects: a Service's Pods, a ReplicaSet's Pods.",
    taught: [{ path: "kubernetes", step: "services", ref: "service" }],
  },
};
