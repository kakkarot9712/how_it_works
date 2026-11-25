import type { SystemMapSpec } from "@/components/path";

/**
 * The Kubernetes path's system map: kubectl, the control plane and one worker node.
 * Every component talks to kube-apiserver, never to each other; only the API server
 * talks to etcd. kube-proxy is optional in the docs, so it is labelled that way.
 * Boxes may point at steps not written yet while the path is hidden.
 */
export const map: SystemMapSpec = {
  width: 1100,
  height: 380,
  regions: [
    { label: "Control plane", x: 200, y: 16, w: 560, h: 348 },
    { label: "Node", x: 800, y: 16, w: 284, h: 348 },
  ],
  nodes: [
    { id: "kubectl", label: "kubectl", lines: ["apply a manifest"], x: 16, y: 112, w: 140, h: 70, step: "kubectl-apply" },
    { id: "apiserver", label: "kube-apiserver", lines: ["the only door to state", "watches, admission"], x: 224, y: 56, w: 200, h: 220, step: "objects-and-watches" },
    { id: "etcd", label: "etcd", lines: ["stores every object"], x: 224, y: 296, w: 200, h: 60, step: "etcd-and-raft" },
    { id: "kcm", label: "kube-controller-manager", lines: ["reconcile loops"], x: 520, y: 56, w: 216, h: 76, step: "reconcile-loops" },
    { id: "scheduler", label: "kube-scheduler", lines: ["filter, score, bind"], x: 520, y: 162, w: 216, h: 76, step: "filter-and-score" },
    { id: "kube-proxy", label: "kube-proxy", lines: ["optional: Service rules"], x: 824, y: 56, w: 236, h: 64, step: "services" },
    { id: "kubelet", label: "kubelet", lines: ["runs this node's Pods"], x: 824, y: 200, w: 236, h: 76, step: "kubelet-and-cri" },
    { id: "runtime", label: "container runtime", lines: ["the kubelet calls it over CRI"], x: 824, y: 296, w: 236, h: 60, step: "kubelet-and-cri" },
  ],
  wires: [
    { points: [[156, 147], [224, 147]], label: "apply" },
    { points: [[520, 94], [424, 94]], label: "watch, write" },
    { points: [[520, 200], [424, 200]], label: "bind" },
    { points: [[824, 262], [424, 262]], label: "watch Pods, report status" },
    { points: [[324, 276], [324, 296]] },
    { points: [[942, 276], [942, 296]] },
  ],  connections: [
    {
      from: "kubectl",
      to: "kube-apiserver",
      call: "create, apply (HTTP requests)",
      pattern: "request/response",
      control: "kubectl only stores the desired state. It starts nothing and returns as soon as the object is saved.",
      step: "kubectl-apply",
    },
    {
      from: "kube-apiserver",
      to: "etcd",
      call: "reads and writes of every object",
      pattern: "request/response",
      control: "Every write is authenticated, authorized and admitted by the API server before it is stored in etcd.",
      step: "kubectl-apply",
    },
    {
      from: "kube-controller-manager",
      to: "kube-apiserver",
      call: "watch, then create or update objects",
      pattern: "watch",
      control: "Controllers decide which objects should exist (a ReplicaSet, its Pods) and act only by writing them. They run no containers.",
      step: "kubectl-apply",
    },
    {
      from: "kube-scheduler",
      to: "kube-apiserver",
      call: "watch unbound Pods, then Binding",
      pattern: "watch",
      control: "The scheduler decides the node, by writing a Binding. It never contacts the node.",
      step: "filter-and-score",
    },
    {
      from: "kubelet",
      to: "kube-apiserver",
      call: "watch its own Pods, PATCH status",
      pattern: "watch",
      control: "Nothing pushes a Pod to a node: the kubelet's watch asks for Pods bound to it. The kubelet decides how to run them and reports what happened.",
      step: "kubelet-and-cri",
    },
    {
      from: "kube-apiserver",
      to: "kubelet",
      call: "logs, attach, port-forward",
      pattern: "request/response",
      control: "The API server opens this one, for these uses. Pods still reach the node only through the kubelet's own watch.",
      step: "kubectl-apply",
    },
    {
      from: "kube-proxy",
      to: "kube-apiserver",
      call: "watch Services and EndpointSlices",
      pattern: "watch",
      control: "kube-proxy (optional) only programs the node's rules, iptables by default. Traffic goes through those rules, not through kube-proxy.",
      step: "services",
    },
    {
      from: "kubelet",
      to: "container runtime",
      call: "CRI (gRPC): RunPodSandbox, CreateContainer, StartContainer",
      pattern: "request/response",
      control: "The kubelet is the client and gives the orders; the runtime runs the containers.",
      step: "kubelet-and-cri",
    },
  ],
};
