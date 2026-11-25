/**
 * Learning paths: a guided tour of one system, module by module, from easy to hard.
 * Server-safe metadata only (no React, no content), used by pages, navigation, the
 * proxy and metadata. Each step's content lives in src/paths/<path>/steps/ and is
 * registered in src/paths/content.tsx under the same slug.
 *
 * A step picks the format that fits its idea (see STEP_KINDS); a full simulator
 * (`lab`) is the expensive one, used where something changes over time or fails.
 */

export type StepKind = "explore" | "trace" | "lab";

/** How each step format is labelled, and what it promises the reader. */
export const STEP_KINDS: Record<StepKind, { label: string; tip: string }> = {
  explore: { label: "Explore", tip: "One knob, instant result: try inputs and see the rule." },
  trace: { label: "Trace", tip: "Follow one request hop by hop, with the state each hop changes." },
  lab: { label: "Lab", tip: "Predict what happens, then break it in the simulator and check." },
};

export interface PathStep {
  slug: string;
  title: string;
  /** One or two sentences: what the reader learns. */
  summary: string;
  kind: StepKind;
  /** Rough reading-and-doing time. */
  minutes: number;
  /** A lab's simulator, as `topic/sim` (must be live in src/catalog.ts). */
  sim?: string;
}

export interface PathModule {
  id: string;
  title: string;
  summary: string;
  steps: PathStep[];
}

export interface LearningPath {
  slug: string;
  /** The system, as in "the Kafka path". */
  name: string;
  title: string;
  tagline: string;
  lede: string;
  /** The topic in src/catalog.ts whose simulators this path uses. */
  topic: string;
  /** Unreleased: left out of `paths`, so it is not listed and its URLs return 404. */
  hidden?: boolean;
  modules: PathModule[];
}

export const allPaths: LearningPath[] = [
  {
    slug: "kafka",
    name: "Kafka",
    title: "Kafka, from one record to a consumer group",
    tagline: "The partitioned log, replication and consumer groups, one idea at a time",
    lede:
      "Start with the log: how a key picks a partition and why order holds only inside one. Follow a single record through the leader, its followers and the high watermark. Then break replication and consumer groups in the simulators, after predicting what will happen.",
    topic: "kafka",
    modules: [
      {
        id: "log",
        title: "The log",
        summary: "Topics are split into partitions. Each partition is an append-only log, and a record's key decides which one it joins.",
        steps: [
          {
            slug: "topics-and-partitions",
            title: "Keys, partitions and offsets",
            summary: "Send keyed records and watch Kafka's real partitioner place them. Then add a partition and see which keys move.",
            kind: "explore",
            minutes: 6,
          },
          {
            slug: "one-record",
            title: "Follow one record",
            summary: "One Produce request with acks=all, hop by hop: the leader's append, two follower fetches, the high watermark, the ack, and the consumer's read.",
            kind: "trace",
            minutes: 8,
          },
        ],
      },
      {
        id: "replication",
        title: "Replication and durability",
        summary: "The ISR, acks and min.insync.replicas decide which acknowledged records survive a crash.",
        steps: [
          {
            slug: "replication-lab",
            title: "Break replication",
            summary: "Four predictions about stalled followers, crashed leaders and acks, each checked in the produce and replicate simulator.",
            kind: "lab",
            minutes: 15,
            sim: "kafka/produce-and-replicate",
          },
        ],
      },
      {
        id: "consumers",
        title: "Consumers",
        summary: "A consumer group splits a topic's partitions between its members so they share the work, and each group reads the whole topic. Every member pulls its partitions and commits how far it got.",
        steps: [
          {
            slug: "consume-and-commit",
            title: "Groups: poll, process, commit",
            summary: "Why consumers work in groups and how one consumer handles several partitions. Then one consumer's fetch, position and committed offset, and what a crash between processing and committing costs.",
            kind: "trace",
            minutes: 10,
          },
          {
            slug: "groups-lab",
            title: "Break a consumer group",
            summary: "Four predictions about scaling out, crashes, commit order and hot keys, each checked in the consumer groups simulator.",
            kind: "lab",
            minutes: 15,
            sim: "kafka/consumer-groups",
          },
        ],
      },
    ],
  },
  {
    slug: "kubernetes",
    name: "Kubernetes",
    title: "Kubernetes, from kubectl apply to a running container",
    tagline: "The API server, controllers, the scheduler and the kubelet, one idea at a time",
    lede:
      "Follow one Deployment from kubectl apply to a running container, and see that every component only watches and writes objects through the API server. Then open each part: the API and etcd, controllers and their reconcile loops, the scheduler, the kubelet, Services, and what happens when a node fails.",
    topic: "kubernetes",
    hidden: true,
    modules: [
      {
        id: "big-picture",
        title: "The big picture",
        summary: "A cluster is an API server holding desired state, and components that watch it and act. One kubectl apply shows all of them at work.",
        steps: [
          {
            slug: "kubectl-apply",
            title: "Follow one kubectl apply",
            summary: "One Deployment, hop by hop: admission, the write to etcd, two controllers, the scheduler's binding, and the kubelet starting the container.",
            kind: "trace",
            minutes: 10,
          },
        ],
      },
      {
        id: "api",
        title: "The API server and etcd",
        summary: "Every object has a resourceVersion. Clients list, then watch from it; the same number turns concurrent writes into conflicts instead of lost updates.",
        steps: [
          {
            slug: "objects-and-watches",
            title: "Objects, resourceVersion and watches",
            summary: "A controller lists and watches, two clients race to write one Deployment (409 Conflict), and a watcher that was away too long gets 410 Gone.",
            kind: "trace",
            minutes: 10,
          },
        ],
      },
      {
        id: "scheduler",
        title: "The scheduler",
        summary: "kube-scheduler filters out nodes a Pod can't run on, scores the rest, and binds the Pod to the best. It never starts anything.",
        steps: [
          {
            slug: "filter-and-score",
            title: "Filter and score",
            summary: "Set a Pod's requests and toleration, cordon a node, and watch a port of the default filters and resource scores choose, or leave the Pod Pending.",
            kind: "explore",
            minutes: 8,
          },
        ],
      },
      {
        id: "node",
        title: "The node",
        summary: "The kubelet turns a bound Pod into containers through the container runtime, probes them, and restarts them when they fail.",
        steps: [
          {
            slug: "kubelet-and-cri",
            title: "kubelet, CRI and the Pod lifecycle",
            summary: "A Pod's sandbox, image and container through CRI, readiness, then two crashes with back-off and a failed liveness probe: phase, Ready and container state side by side.",
            kind: "trace",
            minutes: 10,
          },
        ],
      },
      {
        id: "networking",
        title: "Services and networking",
        summary: "A Service is a stable virtual IP in front of changing Pods. EndpointSlices list the ready ones; kube-proxy turns them into rules on every node.",
        steps: [
          {
            slug: "services",
            title: "A request to a Service",
            summary: "Create a Service, follow one request from DNS through kube-proxy's iptables rules to a Pod, then watch a failing readiness probe take a backend out.",
            kind: "trace",
            minutes: 10,
          },
        ],
      },
    ],
  },
];

/**
 * Published paths: what the site lists, routes and prerenders. Hidden paths are left out of
 * production builds but shown under `pnpm dev`, so the owner can review a path while it's built.
 */
export const paths = allPaths.filter((p) => !p.hidden || process.env.NODE_ENV === "development");

export function getPath(slug: string): LearningPath | undefined {
  return paths.find((p) => p.slug === slug);
}

/** Every step of a path in reading order, with its module and 1-based position. */
export function stepsOf(path: LearningPath): { step: PathStep; module: PathModule; moduleIndex: number; n: number }[] {
  let n = 0;
  return path.modules.flatMap((module, moduleIndex) => module.steps.map((step) => ({ step, module, moduleIndex, n: ++n })));
}

/** A step with its neighbours, for the step page and its prev/next links. */
export function getStep(pathSlug: string, stepSlug: string) {
  const path = getPath(pathSlug);
  if (!path) return undefined;
  const all = stepsOf(path);
  const i = all.findIndex((s) => s.step.slug === stepSlug);
  if (i < 0) return undefined;
  return { path, ...all[i], total: all.length, prev: all[i - 1]?.step, next: all[i + 1]?.step };
}

export const pathMinutes = (path: LearningPath) => stepsOf(path).reduce((m, s) => m + s.step.minutes, 0);
