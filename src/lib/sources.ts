/**
 * Where a module's facts come from. Every sim declares the version of the system
 * it models and the sources behind every claim it makes, in its own `sources.ts`.
 * Modelled on Wikipedia's verifiability rules: a claim stays only if a reliable
 * source that directly supports it is cited. Here "reliable" means the system's
 * own official documentation, specification or source code (`officialSources`),
 * unless the owner has approved something else for this module.
 *
 * Enforced by src/sims/sources.test.ts (see the `source-facts` skill).
 */

/** The owner's sign-off for a relaxation. Only the owner grants these; an agent never adds one on its own. */
export interface OwnerApproval {
  approvedBy: "owner";
  /** ISO date the owner approved it. */
  date: string;
  /** What the owner said and why, in a sentence. */
  reason: string;
}

export interface Reference {
  /** Stable id used by `cite("id")` in the Explainer. */
  id: string;
  title: string;
  publisher: string;
  url: string;
  /** ISO date the agent last read this page. */
  accessed: string;
  /**
   * Commands, options, config names and other code terms this source documents.
   * Every such term shown to users must be covered by at least one reference.
   */
  covers: string[];
  /** Present only when the owner accepted a source outside `officialSources`. */
  approval?: OwnerApproval;
}

/** Rules an owner can relax for one module. */
export type SourceRule = "official-domains" | "coverage" | "section-citations";

export interface SourceSet {
  /** Product or standard modelled, e.g. "Redis Open Source". */
  subject: string;
  /** Version whose documented behaviour the model follows, e.g. "8.10". */
  version: string;
  /** Short label for badges, e.g. "Redis 8.10". */
  label: string;
  /** One or two sentences: which behaviour is version-specific and how the text marks it. */
  versionNote: string;
  /** ISO date the sources were last checked as a set. */
  checked: string;
  /** URL prefixes counted as official for this module (docs, spec, the project's own source code). */
  officialSources: string[];
  /** In the order they are first cited in the Explainer (Wikipedia numbering). */
  references: Reference[];
  /** Owner-approved relaxations for this module only. */
  relaxed?: (OwnerApproval & { rule: SourceRule })[];
}

/** 1-based reference number for an id, or throws (so a bad id fails the build). */
export function refNumber(sources: SourceSet, id: string): number {
  const i = sources.references.findIndex((r) => r.id === id);
  if (i < 0) throw new Error(`Unknown reference "${id}" in ${sources.label} sources`);
  return i + 1;
}

/**
 * A page's own source set, drawn from a shared pool (a learning path's references):
 * the same subject and version, with only the references this page cites, in the
 * order it first cites them, so its [n] numbers start at 1. Unknown ids throw.
 */
export function pickSources(pool: SourceSet, ids: string[]): SourceSet {
  return {
    ...pool,
    references: ids.map((id) => {
      const r = pool.references.find((x) => x.id === id);
      if (!r) throw new Error(`Unknown reference "${id}" in ${pool.label} sources`);
      return r;
    }),
  };
}
