/**
 * Acronyms and codes readers may not know, shown as hover/focus tooltips wherever
 * text is passed through `gloss()` (prose, narration, inspector help, walkthroughs).
 * Keep each `brief` to one or two plain sentences, accurate, and relevant to how
 * the term shows up on this site. Add a term here the first time a sim uses it.
 */
import { CONCEPTS } from "./concepts";

/** Where a learning path teaches a concept term (see concepts.ts). */
export interface Taught {
  path: string;
  /** The first step of the path whose text uses the term. */
  step: string;
  /** Reference id in that path's source pool: the fact behind the brief and note. */
  ref: string;
  /** What the term means in this system, when the brief is generic. */
  note?: string;
  /** Further reference ids in the same pool, for a term with more to it than a brief can hold ("read more"). */
  more?: string[];
}

export interface GlossaryEntry {
  /** What the letters stand for. */
  expansion?: string;
  brief: string;
  /** Other spellings that match, beyond the key and its plural "s" (rebalancing, tainted). */
  forms?: string[];
  /** Concept terms only: where each learning path teaches it. Acronyms have none. */
  taught?: Taught[];
}

const ACRONYMS: Record<string, GlossaryEntry> = {
  TCP: {
    expansion: "Transmission Control Protocol",
    brief: "Reliable, ordered byte stream between two hosts. Flow control (the window) stops a sender when the receiver's buffers are full.",
  },
  FIN: {
    expansion: "TCP finish flag",
    brief: "The packet a side sends to close a connection cleanly: \"I'm done sending.\" If the network is down, it never arrives.",
  },
  RST: {
    expansion: "TCP reset flag",
    brief: "Aborts a connection at once. A host also replies with RST to a connection attempt on a port nobody is listening on.",
  },
  ACK: {
    expansion: "Acknowledgement",
    brief: "Confirmation that data arrived. In TCP the receiver ACKs bytes; in messaging, a consumer acknowledges a message it has processed.",
  },
  p50: {
    expansion: "50th percentile, the median",
    brief: "Half of the requests finished faster than this, half slower. It shows the typical request and hides the slow ones.",
  },
  p95: {
    expansion: "95th percentile",
    brief: "95 of every 100 requests finished at least this fast; the slowest 5 took longer. It shows the tail that a median or average hides.",
  },
  HTTP: {
    expansion: "Hypertext Transfer Protocol",
    brief: "The request/response protocol of the web: a client sends a request and gets back a response with a status code, such as 200 OK or 502 Bad Gateway.",
  },
  ECONNREFUSED: {
    expansion: "Connection refused (OS error code)",
    brief: "What a client's connect() reports when the server host answers with RST, usually because the process isn't running.",
  },
  RESP: {
    expansion: "REdis Serialization Protocol",
    brief: "The simple, human-readable wire format Redis clients and servers speak. An integer reply is sent as \":2\\r\\n\".",
  },
  RESP2: {
    expansion: "REdis Serialization Protocol, version 2",
    brief: "The default protocol version. In RESP2 a subscribed connection can only run (P|S)SUBSCRIBE, (P|S)UNSUBSCRIBE, PING, RESET and QUIT.",
  },
  RESP3: {
    expansion: "REdis Serialization Protocol, version 3",
    brief: "The newer protocol version, chosen per connection with HELLO 3. A subscribed RESP3 connection can still run any command.",
  },
  RDB: {
    expansion: "Redis Database file",
    brief: "A point-in-time snapshot of the dataset written to disk. Pub/Sub messages and subscriptions are never in it.",
  },
  AOF: {
    expansion: "Append Only File",
    brief: "A log of every write command Redis replays on restart. Pub/Sub traffic isn't written to it.",
  },
  RFC: {
    expansion: "Request for Comments",
    brief: "The numbered documents that define internet standards. TCP, for example, is specified in RFC 9293.",
  },
  IETF: {
    expansion: "Internet Engineering Task Force",
    brief: "The standards body that develops internet protocols such as TCP and publishes them as RFCs.",
  },
  OOM: {
    expansion: "Out Of Memory",
    brief: "When the host runs out of RAM, the Linux OOM killer stops a process (often the biggest one) to free memory.",
  },
  RAM: { expansion: "Random Access Memory", brief: "The host's main memory. Redis keeps all its data, and every client's buffers, in RAM." },
  GC: {
    expansion: "Garbage collection",
    brief: "A language runtime reclaiming unused memory. A long GC pause can stop an app from reading its socket for a while.",
  },
  LAN: { expansion: "Local Area Network", brief: "A network inside one site or data centre. Round trips take well under a millisecond." },
  PEL: {
    expansion: "Pending Entries List",
    brief: "Redis Streams' per-consumer-group list of entries delivered to a consumer but not yet acknowledged with XACK.",
  },
  ISR: {
    expansion: "In-Sync Replicas",
    brief: "The Kafka replicas caught up with the partition leader. A write is committed once every one of them has it, and only they can be elected leader in a clean election.",
  },
  ELR: {
    expansion: "Eligible Leader Replicas",
    brief: "Kafka 4.x: replicas outside the ISR that still hold every committed record, so the controller may elect one when the ISR is empty.",
  },
  HB: {
    expansion: "Heartbeat",
    brief: "A consumer's periodic message to the group coordinator saying it is still alive. Its reply can tell the consumer to give up or take partitions.",
  },
  HW: {
    expansion: "High watermark",
    brief: "In Kafka, the offset up to which every in-sync replica has the partition's records. Records below it are committed; consumers only read below it.",
  },
  "high watermark": {
    taught: [{ path: "kafka", step: "one-record", ref: "partition-scala", note: "The smallest log end offset in the ISR." }],
    brief: "Kafka's commit point (HW): the smallest log end offset in the ISR. Records below it are committed and readable by consumers. It only moves while the ISR has at least min.insync.replicas members.",
  },
  LEO: {
    expansion: "Log end offset",
    brief: "The offset the next record appended to a Kafka replica's log will get: one past its last record.",
  },
  KIP: {
    expansion: "Kafka Improvement Proposal",
    brief: "A written proposal for a major change to Apache Kafka, discussed on the developer mailing list and voted on before it is adopted.",
  },
  ACID: {
    expansion: "Atomicity, Consistency, Isolation, Durability",
    brief: "The guarantees a database transaction gives: all-or-nothing, valid states only, no interference, and survives a crash once committed.",
  },
  MVCC: {
    expansion: "Multi-Version Concurrency Control",
    brief: "Readers see a consistent snapshot while writers create new row versions, so reads and writes don't block each other.",
  },
  SSI: {
    expansion: "Serializable Snapshot Isolation",
    brief: "How PostgreSQL's SERIALIZABLE works: snapshot isolation plus non-blocking tracking of who read what, cancelling a transaction when the result could not match any serial order.",
  },
  SQL: {
    expansion: "Structured Query Language",
    brief: "The language relational databases are queried in. The SQL standard defines the four transaction isolation levels used here.",
  },
  SQLSTATE: {
    expansion: "SQL error code",
    brief: "The five-character code PostgreSQL returns with every error, e.g. 40001 for a serialization failure and 40P01 for a deadlock. Apps decide whether to retry by it.",
  },
  WAL: {
    expansion: "Write-Ahead Log",
    brief: "Changes are appended to a log on disk before they're applied, so a crash can be recovered by replaying the log.",
  },
  CPU: {
    expansion: "Central Processing Unit",
    brief: "Processor time. Kubernetes measures it in cores and millicores: 500m is half a core. Pods request it so the scheduler can place them.",
  },
  DNS: {
    expansion: "Domain Name System",
    brief: "Turns names into IP addresses. In Kubernetes, a Service's name resolves to its cluster IP.",
  },
  IP: {
    expansion: "Internet Protocol",
    brief: "The network layer that addresses and routes packets between hosts. Every Pod gets its own IP address; a Service gets a virtual one.",
  },
  DNAT: {
    expansion: "Destination Network Address Translation",
    brief: "Rewriting a packet's destination address on the way through. kube-proxy's rules use it to turn a Service's IP into a Pod's.",
  },
  "UTF-8": {
    expansion: "Unicode Transformation Format, 8-bit",
    brief: "The common way to turn text into bytes: ASCII characters take one byte each, other characters two to four.",
  },
  CRI: {
    expansion: "Container Runtime Interface",
    brief: "The gRPC API the kubelet uses to tell the container runtime to start pod sandboxes, pull images and run containers.",
  },
};

/** Acronyms and concept terms, one dictionary. */
export const GLOSSARY: Record<string, GlossaryEntry> = { ...ACRONYMS, ...CONCEPTS };

/** A concept term (taught by a path) rather than an acronym. */
export const isConcept = (key: string) => Boolean(GLOSSARY[key]?.taught);

/**
 * Phrases (lowercase keys like "high watermark") also match with a capital first
 * letter at the start of a sentence; `glossaryKey` maps that back to the entry.
 */
const capitalize = (t: string) => t[0].toUpperCase() + t.slice(1);
/** Every spelling that matches → its key: the key and its `forms`, lowercase ones also capitalized. */
const FORM_TO_KEY = new Map<string, string>();
for (const [key, g] of Object.entries(GLOSSARY))
  for (const f of [key, ...(g.forms ?? [])]) for (const v of /^[a-z]/.test(f) ? [f, capitalize(f)] : [f]) FORM_TO_KEY.set(v, key);

/** The GLOSSARY key for a matched term ("High watermark" -> "high watermark", "Rebalancing" -> "rebalance"), or undefined. */
export function glossaryKey(term: string): string | undefined {
  return FORM_TO_KEY.get(term);
}

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Whole-word match, longest first (RESP2 over RESP), plus a plural "s" (PELs, ACKs) that
 * stays outside the captured term. A hyphen counts as part of a word, so "node" doesn't
 * match inside "node-1" and "proxy" doesn't match inside "kube-proxy".
 */
const matcher = (forms: string[]) =>
  new RegExp(`(?<![\\w-])(${forms.sort((a, b) => b.length - a.length).map(escape).join("|")})(?=s?(?![\\w-]))`, "g");
const ALL_FORMS = [...FORM_TO_KEY.keys()];
/** Every term: acronyms and concepts. */
export const GLOSSARY_RE = matcher(ALL_FORMS);
/** Acronyms only, for text marked on every use (narration, inspector help), where concept words would clutter. */
export const ACRONYM_RE = matcher(ALL_FORMS.filter((f) => !isConcept(FORM_TO_KEY.get(f)!)));

/** Native tooltip text for every glossary term in `text` (for an SVG <title>), or undefined if it has none. */
export function glossaryTitles(text: string): string | undefined {
  const found = [...new Set([...text.matchAll(GLOSSARY_RE)].map((m) => glossaryKey(m[1])!))];
  return found.length ? found.map((t) => glossaryTitle(t)).join("\n") : undefined;
}

/** One-line form for native tooltips (SVG <title>). */
export function glossaryTitle(term: string): string | undefined {
  const key = glossaryKey(term);
  const g = key && GLOSSARY[key];
  return g && `${key}${g.expansion ? ` (${g.expansion})` : ""}: ${g.brief}`;
}

export interface TaughtTerm {
  key: string;
  entry: GlossaryEntry;
  taught: Taught;
  /** Other paths that teach the same idea (the cross-system cue). */
  alsoIn: string[];
}

/** Concept terms a path teaches, alphabetically; only those first used in `step` if given. */
export function conceptsTaught(path: string, step?: string): TaughtTerm[] {
  return Object.entries(GLOSSARY)
    .flatMap(([key, entry]) =>
      (entry.taught ?? [])
        .filter((t) => t.path === path && (step === undefined || t.step === step))
        .map((taught) => ({ key, entry, taught, alsoIn: entry.taught!.filter((t) => t.path !== path).map((t) => t.path) })),
    )
    .sort((a, b) => a.key.localeCompare(b.key, "en", { sensitivity: "base" }));
}
