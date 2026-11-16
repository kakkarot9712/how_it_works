/**
 * Acronyms and codes readers may not know, shown as hover/focus tooltips wherever
 * text is passed through `gloss()` (prose, narration, inspector help, walkthroughs).
 * Keep each `brief` to one or two plain sentences, accurate, and relevant to how
 * the term shows up on this site. Add a term here the first time a sim uses it.
 */
export interface GlossaryEntry {
  /** What the letters stand for. */
  expansion?: string;
  brief: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
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
    brief: "The default protocol version. In RESP2 a subscribed connection can only run (P)SUBSCRIBE, (P)UNSUBSCRIBE, PING, RESET and QUIT.",
  },
  RDB: {
    expansion: "Redis Database file",
    brief: "A point-in-time snapshot of the dataset written to disk. Pub/Sub messages and subscriptions are never in it.",
  },
  AOF: {
    expansion: "Append Only File",
    brief: "A log of every write command Redis replays on restart. Pub/Sub traffic isn't written to it.",
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
    brief: "The Kafka replicas that are caught up with the partition leader. Only they can become leader without losing acknowledged writes.",
  },
  ACID: {
    expansion: "Atomicity, Consistency, Isolation, Durability",
    brief: "The guarantees a database transaction gives: all-or-nothing, valid states only, no interference, and survives a crash once committed.",
  },
  MVCC: {
    expansion: "Multi-Version Concurrency Control",
    brief: "Readers see a consistent snapshot while writers create new row versions, so reads and writes don't block each other.",
  },
  WAL: {
    expansion: "Write-Ahead Log",
    brief: "Changes are appended to a log on disk before they're applied, so a crash can be recovered by replaying the log.",
  },
};

/** Longest first, so RESP2 wins over RESP. */
const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
export const GLOSSARY_RE = new RegExp(`\\b(${TERMS.join("|")})\\b`, "g");

/** One-line form for native tooltips (SVG <title>). */
export function glossaryTitle(term: string): string | undefined {
  const g = GLOSSARY[term];
  return g && `${term}${g.expansion ? ` (${g.expansion})` : ""}: ${g.brief}`;
}
