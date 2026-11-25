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
        summary: "Consumers pull from partitions, one owner per partition in a group, and commit how far they got.",
        steps: [
          {
            slug: "consume-and-commit",
            title: "Poll, process, commit",
            summary: "A consumer's fetch, its position, the committed offset, and what a crash between processing and committing costs.",
            kind: "trace",
            minutes: 8,
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
];

/** Published paths: what the site lists, routes and prerenders. */
export const paths = allPaths.filter((p) => !p.hidden);

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
