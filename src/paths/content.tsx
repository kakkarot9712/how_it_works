import type { ComponentType } from "react";
import type { Prediction, SystemMapSpec, TraceSpec } from "@/components/path";
import type { SourceSet } from "@/lib/sources";
import { map as kafkaMap } from "./kafka/map";
import { pool as kafkaPool } from "./kafka/sources";
import * as kafkaConsumeAndCommit from "./kafka/steps/consume-and-commit";
import * as kafkaGroupsLab from "./kafka/steps/groups-lab";
import * as kafkaOneRecord from "./kafka/steps/one-record";
import * as kafkaReplicationLab from "./kafka/steps/replication-lab";
import * as kafkaTopicsAndPartitions from "./kafka/steps/topics-and-partitions";

/** What a step file exports. Server-rendered; `Body` wraps its own content in <Prose>. */
export interface StepContent {
  Body: ComponentType;
  /** The references this step cites, in first-citation order (`pickSources(pool, […])`). */
  sources: SourceSet;
  /** Trace steps: the spec, exported so tests can check it. */
  trace?: TraceSpec;
  /** Lab steps: the predictions and the simulator they open, exported so tests can check them. */
  predictions?: Prediction[];
  simHref?: string;
}

export interface PathContent {
  /** Every reference the path may cite. */
  pool: SourceSet;
  map: SystemMapSpec;
  /** By step slug, matching src/paths/catalog.ts. */
  steps: Record<string, StepContent>;
}

/** Path slug → content. Server only. Enforced against the catalog by src/paths/paths.test.ts. */
export const pathContent: Record<string, PathContent> = {
  kafka: {
    pool: kafkaPool,
    map: kafkaMap,
    steps: {
      "topics-and-partitions": kafkaTopicsAndPartitions,
      "one-record": kafkaOneRecord,
      "replication-lab": kafkaReplicationLab,
      "consume-and-commit": kafkaConsumeAndCommit,
      "groups-lab": kafkaGroupsLab,
    },
  },
};
