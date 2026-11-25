---
name: kubernetes-facts
description: Verified, sourced facts about Kubernetes 1.37 for syswork's Kubernetes learning path (the flagship path) - control plane and node components, the API (objects, resourceVersion, watch), controllers and reconcile loops, kube-scheduler filtering and scoring, kubelet, CRI, pod lifecycle, node-pressure eviction, Services and kube-proxy, etcd. Each fact has its official URL and a quote. Use before writing any Kubernetes claim (step text, trace hop, lab prediction, map label, glossary brief), when planning or adding a Kubernetes step or sim, and when a Kubernetes fact isn't in here yet (research it, then add it here).
---

# Kubernetes facts (1.37)

Same contract as `kafka-facts`: every fact here was read on the official page named next to it (`source-facts` rules). Copy names verbatim. **If a fact you need is not here, read it on an official page, then add it here** with the URL and a short quote. Anything under "Not verified" must not ship as a claim.

Status (2026-11-25): verified facts behind the five built steps (`kubectl-apply`, `objects-and-watches`, `filter-and-score`, `kubelet-and-cri`, `services`) are below. Research the rest step by step as each step is written.

## Version

- Supported minors: 1.37, 1.36, 1.35. Latest: **1.37.2, released 2026-10-13**, end of life 2027-10-28. "The Kubernetes project maintains release branches for the most recent three minor releases (1.37, 1.36, 1.35)." <https://kubernetes.io/releases/>
- `https://kubernetes.io/docs/…` is the **v1.37** documentation (version dropdown). Older minors live on `https://v1-36.docs.kubernetes.io/…`. Pages are unversioned in the URL, so when 1.38 ships the same URL changes meaning: record `accessed` and re-check on a version bump.
- Source at tag `v1.37.2`: `https://github.com/kubernetes/kubernetes/tree/v1.37.2` (raw: `https://raw.githubusercontent.com/kubernetes/kubernetes/v1.37.2/<path>`).
- etcd: docs at `https://etcd.io/docs/v3.<n>/` (v3.1 to v3.8 listed). *Which etcd version 1.37 ships with is not verified*: check the 1.37 changelog or `build/dependencies.yaml` at the tag before stating it.

`officialSources` for the Kubernetes pool: `https://kubernetes.io/`, `https://github.com/kubernetes/`, `https://etcd.io/`, `https://github.com/etcd-io/`. The Raft paper (`https://raft.github.io/raft.pdf`) is the spec etcd implements; using it needs either a link from etcd's own docs that you cite alongside, or an owner approval (`source-facts`, "Owner exceptions").

## Page index (all returned 200 on 2026-11-25)

| id (suggested) | Page | URL (prefix `https://kubernetes.io/`) | For steps |
| --- | --- | --- | --- |
| `components` | Kubernetes Components | `docs/concepts/overview/components/` | system map, every module |
| `architecture` | Cluster Architecture | `docs/concepts/architecture/` | system map |
| `k8s-api` | The Kubernetes API | `docs/concepts/overview/kubernetes-api/` | API server |
| `api-concepts` | Kubernetes API Concepts (verbs, watch, resourceVersion, 410 Gone, watch cache) | `docs/reference/using-api/api-concepts/` | objects and watches |
| `objects` | Objects In Kubernetes | `docs/concepts/overview/working-with-objects/` | spec vs status |
| `ssa` | Server-Side Apply | `docs/reference/using-api/server-side-apply/` | `kubectl apply` trace |
| `admission` | Admission Control | `docs/reference/access-authn-authz/admission-controllers/` | `kubectl apply` trace |
| `controllers` | Controllers | `docs/concepts/architecture/controller/` | reconcile loops |
| `deployment` | Deployments | `docs/concepts/workloads/controllers/deployment/` | reconcile, rollout |
| `replicaset` | ReplicaSet | `docs/concepts/workloads/controllers/replicaset/` | reconcile |
| `scheduler` | Kubernetes Scheduler (filtering, scoring) | `docs/concepts/scheduling-eviction/kube-scheduler/` | scheduler Explore |
| `sched-framework` | Scheduling Framework (extension points) | `docs/concepts/scheduling-eviction/scheduling-framework/` | scheduler |
| `preemption` | Pod Priority and Preemption | `docs/concepts/scheduling-eviction/pod-priority-preemption/` | scheduler Lab |
| `nodes` | Nodes (heartbeats, node status) | `docs/concepts/architecture/nodes/` | failure and recovery |
| `leases` | Leases (node heartbeats, leader election) | `docs/concepts/architecture/leases/` | failure and recovery |
| `cri` | Container Runtime Interface | `docs/concepts/architecture/cri/` | kubelet trace |
| `pod-lifecycle` | Pod Lifecycle (phases, conditions, restarts) | `docs/concepts/workloads/pods/pod-lifecycle/` | kubelet trace |
| `eviction` | Node-pressure Eviction | `docs/concepts/scheduling-eviction/node-pressure-eviction/` | kubelet Lab |
| `service` | Service | `docs/concepts/services-networking/service/` | networking trace |
| `networking` | Services, Load Balancing, and Networking | `docs/concepts/services-networking/` | networking |
| `virtual-ips` | Virtual IPs and Service Proxies (kube-proxy modes) | `docs/reference/networking/virtual-ips/` | networking trace |
| `etcd-ops` | Operating etcd clusters for Kubernetes | `docs/tasks/administer-cluster/configure-upgrade-etcd/` | etcd and Raft |
| `apiserver-flags` | kube-apiserver reference | `docs/reference/command-line-tools-reference/kube-apiserver/` | flag names, defaults |
| `kubelet-flags` | kubelet reference | `docs/reference/command-line-tools-reference/kubelet/` | flag names, defaults |
| `scheduler-flags` | kube-scheduler reference | `docs/reference/command-line-tools-reference/kube-scheduler/` | flag names |
| `kcm-flags` | kube-controller-manager reference | `docs/reference/command-line-tools-reference/kube-controller-manager/` | flag names, defaults |
| `glossary` | Kubernetes glossary | `docs/reference/glossary/` | glossary briefs |
| `releases` | Releases | `releases/` | version |
| `keps` | Kubernetes Enhancement Proposals | `https://github.com/kubernetes/enhancements/tree/master/keps` | design intent (like KIPs) |

Fetching tips: `curl -sL <url>`, strip `<script>`/`<style>` and tags in Python (`python3 -I`), collapse whitespace, then regex-search the text and copy the quote. The left nav repeats every page title, so search for a phrase from the body, not a heading. For flags and defaults prefer the component's reference page; for exact behaviour and log lines, the source at the tag.

## Components [components]

- Control plane: "kube-apiserver The core component server that exposes the Kubernetes HTTP API." "etcd Consistent and highly-available key value store for all API server data." "kube-scheduler Looks for Pods not yet bound to a node, and assigns each Pod to a suitable node." "kube-controller-manager Runs controllers to implement Kubernetes API behavior."
- Node: "kubelet Ensures that Pods are running, including their containers." "kube-proxy (optional) Maintains network rules on nodes to implement Services." "Container runtime Software responsible for running containers."
- Note the docs mark kube-proxy **optional**; a map or trace must not imply it is always there.

## API and watches [api-concepts]

- "Kubernetes supports efficient change notifications on resources via watches: in the Kubernetes API, watch is a verb that is used to track changes to an object in Kubernetes as a stream. It is used for the efficient detection of changes."
- The page also covers `resourceVersion` (metadata field and query parameter), semantics for get, list and watch, "410 Gone" responses and the watch cache. *Read those sections before claiming anything about them.*

## Controllers [controllers]

- "In Kubernetes, controllers are control loops that watch the state of your cluster, then make or request changes where needed. Each controller tries to move the current cluster state closer to the desired state."
- The page's own analogy: a thermostat; "desired state" vs "current state".

## Scheduler [scheduler]

- "kube-scheduler selects a node for the pod in a 2-step operation: Filtering, Scoring."
- "The filtering step finds the set of Nodes where it's feasible to schedule the Pod. For example, the PodFitsResources filter checks whether a candidate Node has enough available resources to meet a Pod's specific resource requests." "If the list is empty, that Pod isn't (yet) schedulable."
- "In the scoring step, the scheduler ranks the remaining nodes to choose the most suitable Pod placement. The scheduler assigns a score to each Node that survived filtering, basing this score on the active scoring rules."
- *Not verified:* the current plugin names behind "PodFitsResources" (the page uses the historical name; the scheduling-framework page and `pkg/scheduler/framework/plugins/` at the tag hold the real ones), tie-breaking, `percentageOfNodesToScore`.

## kubectl apply and the request path [kubectl-apply, controlling-access, admission]

- kubectl_apply: "This resource will be created if it doesn't exist yet." `--field-manager` "Default: \"kubectl-client-side-apply\"". `--server-side`: "If true, apply runs in the server instead of the client." (so client-side is the default).
- controlling-access: authentication failure → "rejected with HTTP status code 401"; "If all of the modules deny the request, then the request is denied (HTTP status code 403)." "Once a request passes all admission controllers, it is validated using the validation routines for the corresponding API object, and then written to the object store".
- admission: "The admission control process proceeds in two phases. In the first phase, mutating admission controllers are run. In the second phase, validating admission controllers are run." "If any of the controllers in either phase reject the request, the entire request is rejected immediately". Four extension points: `MutatingAdmissionWebhook`, `MutatingAdmissionPolicy`, `ValidatingAdmissionWebhook`, `ValidatingAdmissionPolicy`.

## Watches and controllers [api-concepts, controllers, kcm-flags]

- api-concepts: watch stream example emits `{"type": "ADDED", ...}` and `{"type": "MODIFIED", ...}` events.
- controllers: "Built-in controllers manage state by interacting with the cluster API server." "The Job controller does not run any Pods or containers itself. Instead, the Job controller tells the API server to create or remove Pods."
- kcm-flags `--controllers` lists `deployment-controller` and `replicaset-controller` (among many).
- deployment: "The Deployment creates a ReplicaSet"; "the name of the ReplicaSet is always formatted as [DEPLOYMENT-NAME]-[HASH]" and "The HASH string is the same as the pod-template-hash label".
- replicaset: "A ReplicaSet then fulfills its purpose by creating and deleting Pods as needed to reach the desired number." "A ReplicaSet is linked to its Pods via the Pods' metadata.ownerReferences field".

## Scheduling and binding [scheduler, sched-framework, default-binder, pod-api]

- scheduler: "The scheduler then notifies the API server about this decision in a process called binding."
- sched-framework: "Each attempt to schedule one Pod is split into two phases, the scheduling cycle and the binding cycle." "Scheduling cycles are run serially, while binding cycles may run concurrently." Extension points include `PreFilter`, `Filter`, `Score`, `Reserve`, `Permit`, `PreBind`, `Bind`.
- Source v1.37.2: `pkg/scheduler/framework/plugins/defaultbinder/default_binder.go` `DefaultBinder.Bind` builds a `v1.Binding`; `pkg/registry/core/pod/storage/storage.go` `BindingREST.setPodNodeAndMetadata` sets `pod.Spec.NodeName` and errors "pod %v is already assigned to node %q" if already set.
- pod-api `nodeName`: "If empty, this pod is a candidate for scheduling by the scheduler defined in schedulerName. Once this field is set, the kubelet for this node becomes responsible for the lifecycle of this pod." Status subresource: `PATCH /api/v1/namespaces/{namespace}/pods/{name}/status`.

## Kubelet and CRI [kubelet-config-src, cri, cri-proto, pod-lifecycle]

- Source v1.37.2 `pkg/kubelet/config/apiserver.go`: `cache.NewListWatchFromClient(..., "pods", metav1.NamespaceAll, fields.OneTermEqualSelector("spec.nodeName", string(nodeName)))`. `pkg/kubelet/status/status_manager.go` calls `statusutil.PatchPodStatus`.
- cri: "The kubelet acts as a client when connecting to the container runtime via gRPC." Endpoint flag `--container-runtime-endpoint`; "For Kubernetes v1.26 and later, the kubelet requires that the container runtime supports the v1 CRI API".
- cri-proto (`staging/src/k8s.io/cri-api/pkg/apis/runtime/v1/api.proto`): "RunPodSandbox creates and starts a pod-level sandbox"; "CreateContainer creates a new container in specified PodSandbox"; "StartContainer starts the container."; "PullImage pulls an image with authentication config."
- pod-lifecycle: Pending: "The Pod has been accepted by the Kubernetes cluster, but one or more of the containers has not been set up and made ready to run. This includes time a Pod spends waiting to be scheduled". Running: "The Pod has been bound to a node, and all of the containers have been created. At least one container is still running, or is in the process of starting or restarting."

## Who talks to whom [cp-node] (`docs/concepts/architecture/control-plane-node-communication/`)

- "Kubernetes has a \"hub-and-spoke\" API pattern. All API usage from nodes (or the pods they run) terminates at the API server. None of the other control plane components are designed to expose remote services."
- "There are two primary communication paths from the control plane (the API server) to the nodes. The first is from the API server to the kubelet process which runs on each node in the cluster. The second is from the API server to any node, pod, or service through the API server's proxy functionality."
- API server → kubelet is used for: "Fetching logs for pods. Attaching (usually through kubectl ) to running pods. Providing the kubelet's port-forwarding functionality."

## What-if facts for the kubectl-apply step

- admission: "If any of the controllers in either phase reject the request, the entire request is rejected immediately and an error is returned to the end-user."
- virtual-ips (`docs/reference/networking/virtual-ips/`): "Each instance of kube-proxy watches the Kubernetes control plane for the addition and removal of Service and EndpointSlice objects. For each Service, kube-proxy calls appropriate APIs (depending on the kube-proxy mode) to configure the node to capture traffic to the Service's clusterIP and port, and redirect that traffic to one of the Service's endpoints". Default mode: "In Kubernetes 1.37, this is iptables, but a future version of Kubernetes will change the default to nftables." Flag `--proxy-mode`.
- pod-lifecycle container states: `Waiting`, `Running`, `Terminated`; Pending "includes ... the time spent downloading container images over the network".

## Watches and resourceVersion [api-concepts] (step objects-and-watches)

- "Clients can send a list or a get and then make a follow-up watch request. To make this change tracking possible, every Kubernetes object has a resourceVersion field representing the version of that resource as stored in the underlying persistence layer." Watch = stream of changes after the given version, "without missing any events"; a disconnected client "can start a new watch from the last returned resourceVersion".
- History: "Clusters using etcd 3 preserve changes in the last 5 minutes by default." On failure clients must recognize "410 Gone, clearing their local cache, performing a new get or list operation, and starting the watch from the resourceVersion that was returned". Go client: Reflector (`k8s.io/client-go/tools/cache`).
- `BOOKMARK` events (`allowWatchBookmarks=true`) carry only `.metadata.resourceVersion`; "you shouldn't assume bookmarks are returned at any specific interval".
- PUT must carry the object's resourceVersion; stale → "409 Conflict". Patch "is typically appropriate if the change that the client wants to make isn't conditional on the existing data".
- "Resource version strings are orderable as monotonically increasing integers within the same resource type for all types served by kube-apiserver" (1.37; Pod vs Deployment not comparable).
- Watch cache: "an internal, in-memory store within the API server that caches and mirrors the state of data persisted into etcd"; "Any" reads are always served from it; 1.37 serves "most recent" reads from it with etcd v3.4.31+/v3.5.13+.
- objects page: spec = desired state; "The status describes the current state of the object, supplied and updated by the Kubernetes system and its components."

## Scheduler internals, source v1.37.2 (step filter-and-score; ported in `src/paths/kubernetes/widgets/schedule.ts`)

- Default plugins (`pkg/scheduler/apis/config/v1/default_plugins.go`) in order: SchedulingGates, PrioritySort, NodeName, NodeUnschedulable, TaintToleration (weight 3), NodeAffinity (2), NodePorts, NodeResourcesFit (1), VolumeRestrictions, NodeVolumeLimits, VolumeBinding, VolumeZone, PodTopologySpread (2), InterPodAffinity (2), DefaultPreemption, NodeResourcesBalancedAllocation (1), ImageLocality (1), DefaultBinder.
- NodeResourcesFit default scoring strategy `LeastAllocated`, cpu and memory weight 1 (`defaults.go`). Score per resource `((capacity-requested)*100)/capacity`, 0 if requested > capacity; average over weights (`least_allocated.go`). `MostAllocated` "favors nodes with most requested resources".
- BalancedAllocation (`balanced_allocation.go`): score = (1 − std of requested/allocatable fractions) × 100, std = |f1−f2|/2 for two resources; returns `50 + (50 + withPod − withoutPod)/2` ("If the difference to the balance is small, the score will be around 75").
- Scoring uses non-zero requests: `DefaultMilliCPURequest = 100`, `DefaultMemoryRequest = 200 * 1024 * 1024` (`pkg/scheduler/util/pod_resources.go`). Fit filter rejects when request > allocatable − requested ("Insufficient cpu", "Insufficient memory").
- Filter messages: "node(s) were unschedulable", "node(s) had untolerated taint(s)" (NoSchedule/NoExecute). FitError: "0/%v nodes are available:" + sorted "count reason" list (`framework/types.go`).
- Total = Σ score × weight (`framework/runtime/framework.go`); highest wins, ties by a random `Randomizer` (`framework/sorted_nodes.go`); one feasible node is taken without scoring (`schedule_one.go`). `MaxNodeScore` 100.
- framework page: "Scheduler plugins register to be invoked at one or more extension points"; Reserve "exists to prevent race conditions while the scheduler waits for the bind to succeed".
- resources page: requests must fit capacity; "although actual memory or CPU resource usage on nodes is very low, the scheduler still refuses to place a Pod on a node if the capacity check fails". taints page: "Tolerations allow scheduling but don't guarantee scheduling". kubectl cordon: "Mark node as unschedulable."

## Kubelet lifecycle [pod-lifecycle, images] (step kubelet-and-cri)

- Container states Waiting ("pulling the container image ... or applying Secret data"), Running, Terminated (reason, exit code). Pod conditions managed by the kubelet: PodScheduled, PodReadyToStartContainers ("sandbox has been successfully created, networking configured ..."), ContainersReady, Initialized, Ready ("should be added to the load balancing pools of all matching Services").
- `restartPolicy` Always (default), OnFailure, Never. "After containers in a Pod exit, the kubelet restarts them with an exponential backoff delay (10s, 20s, 40s, …), that is capped at 300 seconds (5 minutes). Once a container has executed for 10 minutes without any problems, the kubelet resets the restart backoff timer". First crash: immediate restart. CrashLoopBackOff is a kubectl Status display, not a phase.
- Probes: liveness ("If a container fails its liveness probe more times than the configured tolerance, the kubelet restarts that container"), readiness ("the EndpointSlice controller removes the Pod's IP address from the EndpointSlices of all Services that match the Pod"), startup (holds back the others). Mechanisms exec, grpc, httpGet, tcpSocket. Node death: Pods "marked for deletion ... after a timeout period".
- images: `imagePullPolicy` defaults: digest → IfNotPresent; `:latest` or no tag → Always; other tag → IfNotPresent. Always: runtime resolves tag to digest each launch.

## Services [service, endpointslices, virtual-ips, dns] (step services)

- "Kubernetes assigns this Service an IP address (the cluster IP), that is used by the virtual IP address mechanism." Example port 80 → targetPort 9376.
- "The control plane automatically creates EndpointSlices for any Kubernetes Service that has a selector specified." Conditions serving (maps to Pod Ready), terminating, ready ("serving and not terminating"). Default max 100 endpoints per slice (`--max-endpoints-per-slice`, up to 1000).
- iptables mode: per-Service and per-endpoint rules, DNAT; backend chosen "either based on session affinity or randomly", "without rewriting the client IP address" (NodePort/load balancer do alter it); large clusters: kube-proxy "may take a long time to update the rules".
- DNS: Services get `my-svc.my-namespace.svc.cluster-domain.example` resolving to the cluster IP; "kubelet configures Pods' DNS"; unqualified queries are limited to the Pod's namespace.

## Not verified (research before claiming)

Everything the remaining (Lab) steps need, notably: the exact wire calls of client-side apply (GET then POST/PATCH) and HTTP status codes of a create; the event type a field-selector watch emits when an object starts matching; which kubelet path pulls images and in what order relative to the sandbox; informers and the watch cache; node heartbeat and lease intervals, `node-monitor-grace-period` and taint-based eviction timing; kubelet sync loop, PLEG, CRI calls (`RunPodSandbox`, `CreateContainer`, `StartContainer`); eviction signals and default thresholds; kube-proxy modes and which is default in 1.37; EndpointSlices; etcd version and Raft details (election timeout, quorum writes).
