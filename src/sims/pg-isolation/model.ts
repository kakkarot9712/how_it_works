import type { LogLevel, SimContext, SimModel } from "@/engine/types";

/**
 * Two sessions running transactions against one PostgreSQL table, modelled on how
 * PostgreSQL 18 behaves (docs chapter 13 and the server source):
 *
 * - MVCC: an UPDATE never overwrites a row. It writes a new row version (xmin = its
 *   transaction ID) and stamps the old one with xmax. Which version a statement sees
 *   depends only on its snapshot (xmin:xmax:xip_list) and each xid's commit status (pg_xact).
 * - Read Committed (the default; READ UNCOMMITTED behaves the same): every statement takes
 *   a new snapshot. An UPDATE that finds its row locked waits for the other transaction; if
 *   that one commits, the UPDATE re-checks and applies itself to the new version.
 * - Repeatable Read: one snapshot, taken at the first statement after BEGIN. Updating a row
 *   that another transaction changed after that snapshot fails with
 *   `could not serialize access due to concurrent update` (SQLSTATE 40001).
 * - Serializable: Repeatable Read plus SSI. Reads leave SIRead predicate locks, writes
 *   that hit them become rw-conflicts, and a dangerous structure (a pivot with a conflict in
 *   and a conflict out) cancels one transaction with
 *   `could not serialize access due to read/write dependencies among transactions`.
 * - Row locks block only writers and lockers. After deadlock_timeout a waiting backend
 *   checks for a cycle; if it finds one it aborts itself with `deadlock detected` (40P01).
 *
 * The client side is an application that runs small programs (a transfer, a deposit that
 * reads then writes, a withdrawal that checks a rule) and can retry on 40001/40P01.
 * Time runs in slow motion so each statement can be watched.
 */

// ---------- data ----------

export type SessionId = "A" | "B";
export type RowId = "alice" | "bob" | "carol";
export const ROWS: RowId[] = ["alice", "bob", "carol"];
export const TABLE = "accounts";

/** Isolation levels as SQL spells them; settings.isolation is the index. */
export const LEVELS = ["READ UNCOMMITTED", "READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"] as const;
export const READ_COMMITTED = 1;
export const REPEATABLE_READ = 2;
export const SERIALIZABLE = 3;
/** PostgreSQL's Read Uncommitted mode behaves like Read Committed. */
export const effectiveLevel = (level: number) => (level === 0 ? READ_COMMITTED : level);

export interface Version {
  /** Creation order, for display and identity. */
  n: number;
  row: RowId;
  balance: number;
  xmin: number;
  xmax: number | null;
}

/** pg_snapshot: xmin:xmax:xip_list. */
export interface Snap {
  xmin: number;
  xmax: number;
  xip: number[];
}

export type XactStatus = "in progress" | "committed" | "aborted";

/** A statement the client sends. `set` is a literal the app computed; `delta` is `balance = balance + delta`. */
export type Stmt =
  | { op: "begin"; level: number }
  | { op: "select"; row: RowId; forUpdate?: boolean }
  | { op: "select-all" }
  | { op: "sum" }
  | { op: "update"; row: RowId; delta?: number; set?: number; intent: number }
  | { op: "insert"; row: RowId; balance: number }
  | { op: "commit" }
  | { op: "rollback" };

/** One step of a client program. `wait` = ms after the previous reply before this step runs. */
export type Step =
  | { wait: number; kind: "begin" }
  | { wait: number; kind: "sql"; stmt: Exclude<Stmt, { op: "begin" } | { op: "update"; set: number }> }
  /** UPDATE … SET balance = $1, with $1 = the balance the app read + add. */
  | { wait: number; kind: "write-back"; row: RowId; add: number }
  /** App logic: new balance = what it read + add. */
  | { wait: number; kind: "calc"; row: RowId; add: number }
  /** App logic: only go ahead if the sum it read minus `amount` stays ≥ 0. */
  | { wait: number; kind: "check"; amount: number };

export interface Program {
  id: string;
  title: string;
  /** For the session card's header. */
  short: string;
  steps: Step[];
}

export interface Tx {
  key: number;
  xid: number | null;
  /** Level requested in BEGIN (0..3). */
  level: number;
  /** Repeatable Read/Serializable: the transaction snapshot. Read Committed: the last statement's. */
  snapshot: Snap | null;
  /** commitSeq when the snapshot was taken (SSI: which transactions overlap). */
  snapSeq: number;
  aborted: boolean;
  /** A statement sent outside BEGIN … COMMIT runs in its own transaction. */
  implicit: boolean;
  startedAt: number;
  /** What the app meant to change, per row (for spotting lost updates at commit). */
  intended: Partial<Record<RowId, number>>;
  inserted: Partial<Record<RowId, number>>;
  /** Row → version n this transaction last read (non-repeatable reads, lost updates). */
  reads: Partial<Record<RowId, number>>;
  readValues: Partial<Record<RowId, number>>;
  /** Ids returned by the last SELECT * (phantoms). */
  scan: string | null;
  /** Literal write over a version this transaction never read. */
  overwrote: { row: RowId; read: number; over: number; set: number } | null;
  noted: { dirty: boolean; stale: boolean; snapshot: boolean };
}

/** SSI bookkeeping for one Serializable transaction (a SERIALIZABLEXACT). */
export interface SsiTx {
  key: number;
  session: SessionId;
  xid: number | null;
  /** SIRead predicate locks: rows, or "*" for the whole relation (a sequential scan). */
  reads: (RowId | "*")[];
  /** Keys of transactions with an rw-conflict into this one (they read what it wrote). */
  in: number[];
  /** Keys of transactions this one has an rw-conflict out to (it read what they wrote). */
  out: number[];
  snapSeq: number;
  committed: boolean;
  commitSeq: number;
  doomed: boolean;
  aborted: boolean;
}

export interface Wait {
  xid: number;
  holder: SessionId;
  row: RowId;
  since: number;
  gen: number;
  stmt: Stmt;
}

export type Mark = "pending" | "current" | "done" | "error" | "app" | "skipped";

export interface Line {
  sql: string;
  mark: Mark;
  result?: string;
  tone?: "ok" | "warn" | "err" | "muted";
}

export interface Seg {
  start: number;
  end: number | null;
  kind: "stmt" | "wait";
  error?: boolean;
}

export interface Span {
  start: number;
  end: number | null;
  outcome: "open" | "commit" | "abort";
}

export type Backend = "idle" | "active" | "idle in transaction" | "idle in transaction (aborted)";

export interface Session {
  id: SessionId;
  label: string;
  pid: number;
  /** Connection generation: bumped when the backend is terminated. */
  conn: number;
  connected: boolean;
  tx: Tx | null;
  backend: Backend;
  wait: Wait | null;
  /** A statement is on the wire or executing. */
  busy: boolean;
  program: string | null;
  step: number;
  attempt: number;
  status: "none" | "running" | "done" | "failed" | "refused";
  /** The app is stuck (debugger, long call): it sends nothing, its transaction stays open. */
  stalled: boolean;
  stepPending: boolean;
  stepGen: number;
  /** Last single-row value and last sum the app read; the next literal it will write. */
  saved: number | null;
  lastSum: number | null;
  pendingSet: number | null;
  /** After an error inside BEGIN … COMMIT, the app sends ROLLBACK next. */
  mustRollback: { code: string } | null;
  lines: Line[];
  /** Index in `lines` of the statement in flight. */
  lineIdx: number;
  segs: Seg[];
  spans: Span[];
  lastError: { code: string; message: string } | null;
  commits: number;
  aborts: number;
  retries: number;
}

export type PacketKind = "stmt" | "reply";

export interface Packet {
  id: number;
  kind: PacketKind;
  from: string;
  to: string;
  sentAt: number;
  arriveAt: number;
  label: string;
  error?: boolean;
}

export interface Reply {
  tag: string;
  result?: string;
  value?: number;
  sum?: number;
  error?: { code: string; message: string; detail?: string };
}

export interface Settings {
  /** 0 READ UNCOMMITTED, 1 READ COMMITTED, 2 REPEATABLE READ, 3 SERIALIZABLE. */
  isolation: number;
  latencyMs: number;
  deadlockTimeoutMs: number;
}

export interface Components {
  /** The app retries the whole transaction on 40001 and 40P01. */
  retry: boolean;
  /** Repeatable Read's write-conflict check (first updater wins). */
  writeCheck: boolean;
  /** SSI: SIRead locks and rw-conflict tracking at Serializable. */
  ssi: boolean;
  /** The deadlock check after deadlock_timeout. */
  deadlock: boolean;
}

export interface Params {
  settings: Settings;
  components: Components;
}

export interface State {
  settings: Settings;
  components: Components;
  versions: Version[];
  nextN: number;
  nextXid: number;
  latestCompleted: number;
  xact: Record<number, XactStatus>;
  /** Which session each xid belongs to (display). */
  xactOwner: Record<number, SessionId | "setup">;
  sessions: Record<SessionId, Session>;
  rowLocks: Partial<Record<RowId, { xid: number; session: SessionId; mode: "FOR UPDATE" | "FOR NO KEY UPDATE" }>>;
  ssi: SsiTx[];
  commitSeq: number;
  nextTxKey: number;
  /** What each row should hold if every committed change the apps intended had applied. */
  expected: Partial<Record<RowId, number>>;
  lostUpdates: number;
  ruleBroken: boolean;
  serializationFailures: number;
  deadlocks: number;
  waitGen: number;
  packets: Packet[];
  nextId: number;
  flags: { version: boolean; rcSnapshot: boolean; noDetector: boolean; cycle: boolean };
}

// ---------- events & actions ----------

export type Event =
  | { type: "step"; s: SessionId; conn: number; gen: number }
  | { type: "stmt-arrive"; s: SessionId; conn: number; stmt: Stmt; packet: number }
  | { type: "reply-arrive"; s: SessionId; conn: number; reply: Reply; packet: number }
  | { type: "deadlock-check"; s: SessionId; gen: number }
  | { type: "retry"; s: SessionId; conn: number; gen: number }
  | { type: "reconnect"; s: SessionId; conn: number };

export type Action =
  | { type: "run"; s: SessionId; program: string }
  | { type: "exec"; s: SessionId; stmt: Stmt }
  | { type: "set-stalled"; s: SessionId; on: boolean }
  | { type: "cancel"; s: SessionId }
  | { type: "terminate"; s: SessionId };

type Ctx = SimContext<Event>;

// ---------- constants ----------

export const SESSIONS: SessionId[] = ["A", "B"];
export const backendNode = (s: SessionId) => `be:${s}`;
export const HEAP = "heap";
export const XACT = "xact";
export const LOCKS = "locks";

/** The transaction that loaded the table. */
export const SETUP_XID = 739;
export const INITIAL: Record<"alice" | "bob", number> = { alice: 100, bob: 100 };
export const CAROL = 50;
/** The household rule the withdraw programs check: alice + bob must stay ≥ 0. */
export const RULE_TEXT = "alice + bob ≥ 0";

export const RETRY_MS = 900;
export const MAX_ATTEMPTS = 3;
const ROLLBACK_AFTER_ERROR_MS = 300;
const RECONNECT_MS = 1500;
const MAX_LINES = 12;

export const defaultSettings: Settings = { isolation: READ_COMMITTED, latencyMs: 300, deadlockTimeoutMs: 1000 };
export const defaultComponents: Components = { retry: true, writeCheck: true, ssi: true, deadlock: true };

// ---------- programs ----------

const step = {
  begin: (wait = 0): Step => ({ wait, kind: "begin" }),
  sql: (stmt: Extract<Step, { kind: "sql" }>["stmt"], wait = 900): Step => ({ wait, kind: "sql", stmt }),
};

export const PROGRAMS: Record<string, Program> = {
  transfer: {
    id: "transfer",
    short: "transfer 30 → bob",
    title: "Transfer 30 from alice to bob",
    steps: [
      step.begin(),
      step.sql({ op: "update", row: "alice", delta: -30, intent: -30 }, 700),
      step.sql({ op: "update", row: "bob", delta: 30, intent: 30 }, 2400),
      step.sql({ op: "commit" }, 900),
    ],
  },
  "transfer-back": {
    id: "transfer-back",
    short: "transfer 20 → alice",
    title: "Transfer 20 from bob to alice",
    steps: [
      step.begin(),
      step.sql({ op: "update", row: "bob", delta: -20, intent: -20 }, 700),
      step.sql({ op: "update", row: "alice", delta: 20, intent: 20 }, 1300),
      step.sql({ op: "commit" }, 900),
    ],
  },
  report: {
    id: "report",
    short: "report",
    title: "Report: total money, twice",
    steps: [step.begin(), step.sql({ op: "sum" }, 700), step.sql({ op: "sum" }, 4200), step.sql({ op: "commit" }, 900)],
  },
  "read-twice": {
    id: "read-twice",
    short: "read twice",
    title: "Read every account, twice",
    steps: [step.begin(), step.sql({ op: "select-all" }, 700), step.sql({ op: "select-all" }, 6000), step.sql({ op: "commit" }, 900)],
  },
  "read-alice": {
    id: "read-alice",
    short: "read alice",
    title: "Read alice's balance",
    steps: [step.begin(), step.sql({ op: "select", row: "alice" }, 700), step.sql({ op: "commit" }, 2000)],
  },
  "edit-accounts": {
    id: "edit-accounts",
    short: "charge + insert",
    title: "Charge alice 30, open carol's account",
    steps: [
      step.begin(),
      step.sql({ op: "update", row: "alice", delta: -30, intent: -30 }, 700),
      step.sql({ op: "insert", row: "carol", balance: CAROL }, 900),
      step.sql({ op: "commit" }, 900),
    ],
  },
  "charge-then-undo": {
    id: "charge-then-undo",
    short: "charge, then undo",
    title: "Charge alice 30, then roll back",
    steps: [step.begin(), step.sql({ op: "update", row: "alice", delta: -30, intent: -30 }, 700), step.sql({ op: "rollback" }, 4200)],
  },
  "deposit-50": {
    id: "deposit-50",
    short: "deposit 50",
    title: "Deposit 50: read, add in the app, write back",
    steps: [
      step.begin(),
      step.sql({ op: "select", row: "alice" }, 700),
      { wait: 400, kind: "calc", row: "alice", add: 50 },
      { wait: 500, kind: "write-back", row: "alice", add: 50 },
      step.sql({ op: "commit" }, 1600),
    ],
  },
  "deposit-30": {
    id: "deposit-30",
    short: "deposit 30",
    title: "Deposit 30: read, add in the app, write back",
    steps: [
      step.begin(),
      step.sql({ op: "select", row: "alice" }, 700),
      { wait: 400, kind: "calc", row: "alice", add: 30 },
      { wait: 500, kind: "write-back", row: "alice", add: 30 },
      step.sql({ op: "commit" }, 900),
    ],
  },
  "deposit-30-locked": {
    id: "deposit-30-locked",
    short: "deposit 30, FOR UPDATE",
    title: "Deposit 30 with SELECT … FOR UPDATE",
    steps: [
      step.begin(),
      step.sql({ op: "select", row: "alice", forUpdate: true }, 700),
      { wait: 400, kind: "calc", row: "alice", add: 30 },
      { wait: 500, kind: "write-back", row: "alice", add: 30 },
      step.sql({ op: "commit" }, 900),
    ],
  },
  "withdraw-alice": {
    id: "withdraw-alice",
    short: "withdraw 150 from alice",
    title: "Withdraw 150 from alice if alice + bob stays ≥ 0",
    steps: [
      step.begin(),
      step.sql({ op: "sum" }, 700),
      { wait: 400, kind: "check", amount: 150 },
      step.sql({ op: "update", row: "alice", delta: -150, intent: -150 }, 500),
      step.sql({ op: "commit" }, 1400),
    ],
  },
  "withdraw-bob": {
    id: "withdraw-bob",
    short: "withdraw 150 from bob",
    title: "Withdraw 150 from bob if alice + bob stays ≥ 0",
    steps: [
      step.begin(),
      step.sql({ op: "sum" }, 700),
      { wait: 400, kind: "check", amount: 150 },
      step.sql({ op: "update", row: "bob", delta: -150, intent: -150 }, 500),
      step.sql({ op: "commit" }, 1400),
    ],
  },
};

/** Programs offered in the session inspector, in order. */
export const PROGRAM_MENU = [
  "transfer",
  "transfer-back",
  "deposit-50",
  "deposit-30",
  "deposit-30-locked",
  "withdraw-alice",
  "withdraw-bob",
  "report",
  "read-twice",
  "edit-accounts",
];

// ---------- SQL text ----------

const signed = (d: number) => (d < 0 ? `- ${-d}` : `+ ${d}`);

export function sqlOf(stmt: Stmt): string {
  switch (stmt.op) {
    case "begin":
      return `BEGIN ISOLATION LEVEL ${LEVELS[stmt.level]}`;
    case "select":
      return `SELECT balance FROM ${TABLE} WHERE id = '${stmt.row}'${stmt.forUpdate ? " FOR UPDATE" : ""}`;
    case "select-all":
      return `SELECT * FROM ${TABLE}`;
    case "sum":
      return `SELECT sum(balance) FROM ${TABLE}`;
    case "update":
      return stmt.set !== undefined
        ? `UPDATE ${TABLE} SET balance = ${stmt.set} WHERE id = '${stmt.row}'`
        : `UPDATE ${TABLE} SET balance = balance ${signed(stmt.delta ?? 0)} WHERE id = '${stmt.row}'`;
    case "insert":
      return `INSERT INTO ${TABLE} VALUES ('${stmt.row}', ${stmt.balance})`;
    case "commit":
      return "COMMIT";
    case "rollback":
      return "ROLLBACK";
  }
}

function verb(stmt: Stmt): string {
  return stmt.op === "select-all" || stmt.op === "sum" ? "SELECT" : stmt.op.toUpperCase();
}

function stepSql(s: State, st: Step): string {
  switch (st.kind) {
    case "begin":
      return sqlOf({ op: "begin", level: s.settings.isolation });
    case "sql":
      return sqlOf(st.stmt);
    case "write-back":
      return `UPDATE ${TABLE} SET balance = $1 WHERE id = '${st.row}'`;
    case "calc":
      return `-- app: $1 = ${st.row}'s balance + ${st.add}`;
    case "check":
      return `-- app: go ahead only if sum - ${st.amount} ≥ 0`;
  }
}

// ---------- helpers ----------

const sessionLabel = (id: SessionId) => `Session ${id}`;

function sendPacket(s: State, ctx: Ctx, p: Omit<Packet, "id" | "sentAt" | "arriveAt">): Packet {
  const arriveAt = ctx.now + s.settings.latencyMs * ctx.rng.range(0.9, 1.1);
  const packet: Packet = { ...p, id: s.nextId++, sentAt: ctx.now, arriveAt };
  s.packets.push(packet);
  return packet;
}

function dropPacket(s: State, id: number) {
  const i = s.packets.findIndex((p) => p.id === id);
  if (i >= 0) s.packets.splice(i, 1);
}

export function status(s: State, xid: number): XactStatus {
  return s.xact[xid] ?? "aborted";
}

function seen(snap: Snap, xid: number): boolean {
  return xid < snap.xmax && !snap.xip.includes(xid);
}

export function snapText(snap: Snap | null): string {
  return snap ? `${snap.xmin}:${snap.xmax}:${snap.xip.join(",")}` : "—";
}

/** The MVCC visibility rule for one row version. */
export function isVisible(s: State, v: Version, snap: Snap, own: number | null): boolean {
  const xminOk = v.xmin === own || (status(s, v.xmin) === "committed" && seen(snap, v.xmin));
  if (!xminOk) return false;
  if (v.xmax === null) return true;
  if (v.xmax === own) return false;
  const st = status(s, v.xmax);
  if (st === "aborted") return true;
  if (st === "committed" && seen(snap, v.xmax)) return false;
  return true;
}

export function visibleVersion(s: State, row: RowId, snap: Snap, own: number | null): Version | undefined {
  for (let i = s.versions.length - 1; i >= 0; i--) {
    const v = s.versions[i];
    if (v.row === row && isVisible(s, v, snap, own)) return v;
  }
  return undefined;
}

/** Newest version of a row that wasn't rolled back: the head of its update chain. */
function latestLive(s: State, row: RowId): Version | undefined {
  for (let i = s.versions.length - 1; i >= 0; i--) {
    const v = s.versions[i];
    if (v.row === row && status(s, v.xmin) !== "aborted") return v;
  }
  return undefined;
}

/** Latest committed value of a row, as a fresh snapshot would see it (no transaction of its own). */
export function committedValue(s: State, row: RowId): number | undefined {
  return visibleVersion(s, row, takeSnapshot(s, null), null)?.balance;
}

function takeSnapshot(s: State, own: number | null): Snap {
  const xmax = s.latestCompleted + 1;
  const xip = SESSIONS.map((id) => s.sessions[id].tx)
    .filter((t): t is Tx => !!t && t.xid !== null && !t.aborted && t.xid !== own && t.xid < xmax)
    .map((t) => t.xid as number)
    .sort((a, b) => a - b);
  return { xmin: xip.length ? xip[0] : xmax, xmax, xip };
}

function assignXid(s: State, sess: Session): number {
  const tx = sess.tx!;
  if (tx.xid === null) {
    tx.xid = s.nextXid++;
    s.xact[tx.xid] = "in progress";
    s.xactOwner[tx.xid] = sess.id;
    const ssi = ssiOf(s, tx);
    if (ssi) ssi.xid = tx.xid;
  }
  return tx.xid;
}

function newTx(s: State, ctx: Ctx, sess: Session, level: number, implicit: boolean): Tx {
  const tx: Tx = {
    key: s.nextTxKey++,
    xid: null,
    level,
    snapshot: null,
    snapSeq: s.commitSeq,
    aborted: false,
    implicit,
    startedAt: ctx.now,
    intended: {},
    inserted: {},
    reads: {},
    readValues: {},
    scan: null,
    overwrote: null,
    noted: { dirty: false, stale: false, snapshot: false },
  };
  sess.tx = tx;
  if (effectiveLevel(level) === SERIALIZABLE && s.components.ssi)
    s.ssi.push({ key: tx.key, session: sess.id, xid: null, reads: [], in: [], out: [], snapSeq: s.commitSeq, committed: false, commitSeq: 0, doomed: false, aborted: false });
  return tx;
}

function ssiOf(s: State, tx: Tx | null): SsiTx | undefined {
  return tx ? s.ssi.find((x) => x.key === tx.key) : undefined;
}

const ssiByKey = (s: State, key: number) => s.ssi.find((x) => x.key === key);

function serializationError(detail: string): Reply["error"] {
  return {
    code: "40001",
    message: "could not serialize access due to read/write dependencies among transactions",
    detail: `Reason code: ${detail} HINT: The transaction might succeed if retried.`,
  };
}

class SqlError extends Error {
  readonly err: NonNullable<Reply["error"]>;
  constructor(err: NonNullable<Reply["error"]>) {
    super(err.message);
    this.err = err;
  }
}

// ---------- SSI ----------

/** rw-conflict reader → writer: the reader didn't see the writer's change. Checks for a dangerous structure first. */
function flagRW(s: State, ctx: Ctx, reader: SsiTx, writer: SsiTx, me: SsiTx) {
  if (reader.key === writer.key || reader.out.includes(writer.key)) return;
  let failure = false;
  // R -> W -> T2, where W committed with a conflict out (we must be the reader).
  if (writer.committed && writer.out.length > 0) failure = true;
  // R -> W -> T2 with T2 committed first.
  if (!failure)
    for (const k of writer.out) {
      const t2 = ssiByKey(s, k);
      if (t2?.committed && (!reader.committed || t2.commitSeq <= reader.commitSeq) && (!writer.committed || t2.commitSeq <= writer.commitSeq)) {
        failure = true;
        break;
      }
    }
  // T0 -> R -> W with W committed.
  if (!failure && writer.committed)
    for (const k of reader.in) {
      const t0 = ssiByKey(s, k);
      if (t0 && !t0.doomed && (!t0.committed || t0.commitSeq >= writer.commitSeq)) {
        failure = true;
        break;
      }
    }
  if (failure) {
    if (me.key === writer.key) throw new SqlError(serializationError("Canceled on identification as a pivot, during write.")!);
    if (writer.committed) throw new SqlError(serializationError(`Canceled on conflict out to pivot ${writer.xid}, during read.`)!);
    writer.doomed = true;
    ctx.log("info", `SSI marks ${sessionLabel(writer.session)}'s transaction to be cancelled`, {
      detail: "It is the pivot of a dangerous structure of rw-conflicts. It will fail at its next statement or at COMMIT.",
      node: LOCKS,
    });
  }
  reader.out.push(writer.key);
  writer.in.push(reader.key);
  const r = reader.session === writer.session ? "" : `${sessionLabel(reader.session)} → ${sessionLabel(writer.session)}`;
  if (r)
    ctx.log("info", `SSI records an rw-conflict: ${r}`, {
      detail: `${sessionLabel(reader.session)} read data that ${sessionLabel(writer.session)} changed without seeing the change, so in any serial order ${sessionLabel(reader.session)} must come first. On its own that is fine; a cycle is not.`,
      node: LOCKS,
    });
}

/** Overlapping: neither committed before the other took its snapshot. */
function overlaps(a: SsiTx, b: SsiTx): boolean {
  return (!a.committed || a.commitSeq > b.snapSeq) && (!b.committed || b.commitSeq > a.snapSeq);
}

function ssiRead(s: State, ctx: Ctx, sess: Session, target: RowId | "*", rows: RowId[]) {
  const me = ssiOf(s, sess.tx);
  if (!me) return;
  if (me.doomed) throw new SqlError(serializationError("Canceled on identification as a pivot, during conflict out checking.")!);
  if (!me.reads.includes(target)) me.reads.push(target);
  // Conflict out: a newer version of a row we read, written by an overlapping serializable transaction we can't see.
  const tx = sess.tx!;
  for (const row of rows) {
    const vis = tx.snapshot ? visibleVersion(s, row, tx.snapshot, tx.xid) : undefined;
    for (const v of s.versions) {
      if (v.row !== row || v.n <= (vis?.n ?? -1) || v.xmin === tx.xid || status(s, v.xmin) === "aborted") continue;
      const w = s.ssi.find((x) => x.xid === v.xmin && !x.aborted);
      if (w && overlaps(me, w)) flagRW(s, ctx, me, w, me);
    }
  }
}

function ssiWrite(s: State, ctx: Ctx, sess: Session, row: RowId) {
  const me = ssiOf(s, sess.tx);
  if (!me) return;
  if (me.doomed) throw new SqlError(serializationError("Canceled on identification as a pivot, during conflict in checking.")!);
  for (const r of s.ssi) {
    if (r.key === me.key || r.aborted || !overlaps(r, me)) continue;
    if (r.reads.includes(row) || r.reads.includes("*")) flagRW(s, ctx, r, me, me);
  }
}

/** PreCommit_CheckForSerializationFailure: cancel the pivot if this commit would complete a dangerous structure. */
function ssiPreCommit(s: State, ctx: Ctx, sess: Session) {
  const me = ssiOf(s, sess.tx);
  if (!me) return;
  if (me.doomed) throw new SqlError(serializationError("Canceled on identification as a pivot, during commit attempt.")!);
  for (const k of me.in) {
    const near = ssiByKey(s, k);
    if (!near || near.committed || near.doomed) continue;
    for (const fk of near.in) {
      const far = ssiByKey(s, fk);
      if (far && (far.key === me.key || (!far.committed && !far.doomed))) {
        near.doomed = true;
        ctx.log("warn", `SSI dooms ${sessionLabel(near.session)}: committing ${sessionLabel(sess.id)} completes a cycle`, {
          detail: `${sessionLabel(near.session)} has an rw-conflict in and out: the pivot of a dangerous structure. ${sessionLabel(sess.id)} is allowed to commit so that progress is made; ${sessionLabel(near.session)} will get SQLSTATE 40001.`,
          node: LOCKS,
        });
        break;
      }
    }
  }
}

/** SIRead locks outlive commit until no overlapping transaction is left. */
function ssiCleanup(s: State) {
  s.ssi = s.ssi.filter((x) => {
    if (x.aborted) return false;
    if (!x.committed) return true;
    return s.ssi.some((o) => !o.committed && !o.aborted && o.key !== x.key && overlaps(x, o));
  });
  for (const x of s.ssi) {
    x.in = x.in.filter((k) => s.ssi.some((o) => o.key === k));
    x.out = x.out.filter((k) => s.ssi.some((o) => o.key === k));
  }
}

// ---------- client: lines, lanes, programs ----------

function setLine(sess: Session, i: number, patch: Partial<Line>) {
  if (sess.lines[i]) Object.assign(sess.lines[i], patch);
}

function pushLine(sess: Session, line: Line): number {
  sess.lines.push(line);
  while (sess.lines.length > MAX_LINES) {
    sess.lines.shift();
    sess.lineIdx--;
  }
  return sess.lines.length - 1;
}

function startAttempt(s: State, ctx: Ctx, sess: Session) {
  const prog = PROGRAMS[sess.program!];
  sess.step = 0;
  sess.status = "running";
  sess.saved = null;
  sess.lastSum = null;
  sess.pendingSet = null;
  sess.mustRollback = null;
  sess.lines = prog.steps.map((st) => ({ sql: stepSql(s, st), mark: st.kind === "calc" || st.kind === "check" ? "app" : "pending" }));
  sess.lineIdx = -1;
  scheduleStep(sess, ctx, prog.steps[0].wait);
}

function scheduleStep(sess: Session, ctx: Ctx, wait: number) {
  sess.stepGen++;
  ctx.schedule(wait, { type: "step", s: sess.id, conn: sess.conn, gen: sess.stepGen });
}

function sendStmt(s: State, ctx: Ctx, sess: Session, stmt: Stmt, lineIdx: number) {
  sess.busy = true;
  sess.lineIdx = lineIdx;
  setLine(sess, lineIdx, { sql: sqlOf(stmt), mark: "current", result: undefined, tone: undefined });
  sess.segs.push({ start: ctx.now, end: null, kind: "stmt" });
  if (stmt.op === "begin") sess.spans.push({ start: ctx.now, end: null, outcome: "open" });
  const p = sendPacket(s, ctx, { kind: "stmt", from: sess.id, to: backendNode(sess.id), label: verb(stmt) });
  ctx.schedule(p.arriveAt - ctx.now, { type: "stmt-arrive", s: sess.id, conn: sess.conn, stmt, packet: p.id });
}

/** Run the session's next program step (client side). */
function runStep(s: State, ctx: Ctx, sess: Session) {
  if (sess.stalled) {
    sess.stepPending = true;
    return;
  }
  const prog = sess.program ? PROGRAMS[sess.program] : null;
  if (sess.mustRollback) {
    const i = pushLine(sess, { sql: "ROLLBACK", mark: "pending" });
    sendStmt(s, ctx, sess, { op: "rollback" }, i);
    return;
  }
  if (!prog || sess.status !== "running") return;
  const st = prog.steps[sess.step];
  if (!st) {
    sess.status = "done";
    return;
  }
  const i = sess.step;
  switch (st.kind) {
    case "begin":
      return sendStmt(s, ctx, sess, { op: "begin", level: s.settings.isolation }, i);
    case "sql":
      return sendStmt(s, ctx, sess, st.stmt, i);
    case "write-back": {
      const set = sess.pendingSet ?? (sess.saved ?? 0) + st.add;
      return sendStmt(s, ctx, sess, { op: "update", row: st.row, set, intent: st.add }, i);
    }
    case "calc": {
      const read = sess.saved ?? 0;
      sess.pendingSet = read + st.add;
      setLine(sess, i, { sql: `-- app: $1 = ${read} + ${st.add} = ${sess.pendingSet}`, mark: "app" });
      return advance(s, ctx, sess);
    }
    case "check": {
      const sum = sess.lastSum ?? 0;
      const left = sum - st.amount;
      if (left >= 0) {
        setLine(sess, i, { sql: `-- app: ${sum} - ${st.amount} = ${left} ≥ 0, go ahead`, mark: "app", tone: "ok" });
        return advance(s, ctx, sess);
      }
      setLine(sess, i, { sql: `-- app: ${sum} - ${st.amount} = ${left} < 0, refuse`, mark: "app", tone: "warn" });
      ctx.log("ok", `${sess.label}'s app refuses the withdrawal: the household would go to ${left}`, {
        detail: `This attempt started after the other withdrawal committed, so its snapshot includes it: sum(balance) = ${sum}. The rule ${RULE_TEXT} holds.`,
        node: sess.id,
      });
      for (let k = i + 1; k < prog.steps.length; k++) setLine(sess, k, { mark: "skipped" });
      sess.status = "refused";
      sess.mustRollback = { code: "app" };
      return scheduleStep(sess, ctx, 300);
    }
  }
}

function advance(s: State, ctx: Ctx, sess: Session) {
  const prog = sess.program ? PROGRAMS[sess.program] : null;
  if (!prog || sess.status !== "running") return;
  sess.step++;
  const next = prog.steps[sess.step];
  if (!next) {
    sess.status = "done";
    return;
  }
  scheduleStep(sess, ctx, next.wait);
}

function onReply(s: State, ctx: Ctx, sess: Session, reply: Reply) {
  sess.busy = false;
  const seg = sess.segs[sess.segs.length - 1];
  if (seg && seg.end === null) {
    seg.end = ctx.now;
    if (reply.error) seg.error = true;
  }
  const span = sess.spans[sess.spans.length - 1];
  if (span && span.end === null && (reply.tag === "COMMIT" || reply.tag === "ROLLBACK")) {
    span.end = ctx.now;
    span.outcome = reply.tag === "COMMIT" ? "commit" : "abort";
  }
  if (reply.value !== undefined) sess.saved = reply.value;
  if (reply.sum !== undefined) sess.lastSum = reply.sum;

  const i = sess.lineIdx;
  if (reply.error) {
    sess.lastError = { code: reply.error.code, message: reply.error.message };
    setLine(sess, i, { mark: "error", result: `ERROR: ${reply.error.message}`, tone: "err" });
    const prog = sess.program ? PROGRAMS[sess.program] : null;
    if (prog && sess.status === "running") for (let k = i + 1; k < prog.steps.length; k++) setLine(sess, k, { mark: "skipped" });
    if (sess.tx) {
      // Inside BEGIN … COMMIT: the transaction is aborted; the app must ROLLBACK.
      sess.mustRollback = { code: reply.error.code };
      if (sess.status === "running") sess.status = "failed";
      scheduleStep(sess, ctx, ROLLBACK_AFTER_ERROR_MS);
    } else if (sess.status === "running") sess.status = "failed";
    return;
  }

  const tone = reply.tag === "ROLLBACK" ? "warn" : reply.tag === "COMMIT" ? "ok" : undefined;
  setLine(sess, i, { mark: "done", result: reply.result ?? reply.tag, tone });

  if (sess.mustRollback && reply.tag === "ROLLBACK") {
    const code = sess.mustRollback.code;
    sess.mustRollback = null;
    if (sess.program && (code === "40001" || code === "40P01")) {
      if (s.components.retry && sess.attempt < MAX_ATTEMPTS) {
        sess.stepGen++;
        ctx.schedule(RETRY_MS, { type: "retry", s: sess.id, conn: sess.conn, gen: sess.stepGen });
      } else {
        sess.status = "failed";
        ctx.log("error", `${sess.label}'s app gives up: the ${PROGRAMS[sess.program].title.toLowerCase()} never happened`, {
          detail: s.components.retry
            ? `It failed ${MAX_ATTEMPTS} times.`
            : `The retry block is removed, so the error goes to the user. PostgreSQL has no automatic retry: the application must re-run the whole transaction on SQLSTATE ${code}.`,
          node: sess.id,
        });
      }
    }
    return;
  }
  if (sess.program && sess.status === "running") advance(s, ctx, sess);
}

// ---------- server: statements ----------

function reply(s: State, ctx: Ctx, sess: Session, r: Reply) {
  const p = sendPacket(s, ctx, { kind: "reply", from: backendNode(sess.id), to: sess.id, label: r.error ? "ERROR" : r.tag, error: !!r.error });
  ctx.schedule(p.arriveAt - ctx.now, { type: "reply-arrive", s: sess.id, conn: sess.conn, reply: r, packet: p.id });
}

function idleState(sess: Session): Backend {
  if (!sess.tx) return "idle";
  return sess.tx.aborted ? "idle in transaction (aborted)" : "idle in transaction";
}

function onStmt(s: State, ctx: Ctx, sess: Session, stmt: Stmt) {
  sess.backend = "active";
  if (stmt.op === "begin") {
    if (!sess.tx) beginTx(s, ctx, sess, stmt.level);
    return finish(s, ctx, sess, { tag: "BEGIN" });
  }
  if (stmt.op === "commit" || stmt.op === "rollback") {
    if (!sess.tx) return finish(s, ctx, sess, { tag: stmt.op === "commit" ? "COMMIT" : "ROLLBACK", result: "WARNING: there is no transaction in progress" });
    if (stmt.op === "rollback" || sess.tx.aborted) {
      // COMMIT of a failed transaction block is reported as ROLLBACK.
      endTx(s, ctx, sess, false, sess.tx.aborted ? undefined : "ROLLBACK");
      return finish(s, ctx, sess, { tag: "ROLLBACK" });
    }
    return commit(s, ctx, sess);
  }
  if (!sess.tx) newTx(s, ctx, sess, s.settings.isolation, true);
  if (sess.tx!.aborted)
    return finish(s, ctx, sess, {
      tag: "ERROR",
      error: { code: "25P02", message: "current transaction is aborted, commands ignored until end of transaction block" },
    });
  runDml(s, ctx, sess, stmt, false);
}

function beginTx(s: State, ctx: Ctx, sess: Session, level: number) {
  newTx(s, ctx, sess, level, false);
  if (level === 0)
    ctx.log("info", `${sess.label}: BEGIN ISOLATION LEVEL READ UNCOMMITTED runs as READ COMMITTED`, {
      detail: "PostgreSQL accepts all four standard levels but implements three: Read Uncommitted behaves like Read Committed, so it never reads uncommitted data.",
      node: sess.id,
    });
}

/** Execute SELECT / UPDATE / INSERT. `resumed` = after waiting for a row lock. */
function runDml(s: State, ctx: Ctx, sess: Session, stmt: Stmt, resumed: boolean) {
  const tx = sess.tx!;
  const level = effectiveLevel(tx.level);
  try {
    if (!resumed) {
      if (level === READ_COMMITTED) {
        tx.snapshot = takeSnapshot(s, tx.xid);
        if (!s.flags.rcSnapshot) {
          s.flags.rcSnapshot = true;
          ctx.log("info", `${sess.label}'s statement takes a new snapshot, ${snapText(tx.snapshot)}`, {
            detail: "Read Committed: every statement sees the data committed before that statement began (xmin:xmax:xip_list). The next statement in the same transaction gets a newer snapshot.",
            node: sess.id,
          });
        }
      } else if (!tx.snapshot) {
        tx.snapshot = takeSnapshot(s, tx.xid);
        tx.snapSeq = s.commitSeq;
        const me = ssiOf(s, tx);
        if (me) me.snapSeq = s.commitSeq;
        ctx.log("info", `${sess.label}'s transaction snapshot is ${snapText(tx.snapshot)}`, {
          detail: `${LEVELS[tx.level]}: taken at the first statement after BEGIN, then frozen. The transaction sees only xids below ${tx.snapshot.xmax} that are not in progress (${tx.snapshot.xip.join(", ") || "none"}), plus its own changes.`,
          node: sess.id,
        });
      }
    }
    const snap = tx.snapshot!;

    switch (stmt.op) {
      case "select":
        if (stmt.forUpdate) return lockAndWrite(s, ctx, sess, stmt, resumed);
        return readRow(s, ctx, sess, stmt.row, snap);
      case "select-all":
      case "sum":
        return readAll(s, ctx, sess, stmt.op, snap);
      case "update":
        return lockAndWrite(s, ctx, sess, stmt, resumed);
      case "insert":
        return insertRow(s, ctx, sess, stmt);
      default:
        return;
    }
  } catch (e) {
    if (e instanceof SqlError) return fail(s, ctx, sess, e.err);
    throw e;
  }
}

/** Note when a read skipped a newer version: uncommitted (no dirty read) or committed after the snapshot. */
function noteSkipped(s: State, ctx: Ctx, sess: Session, row: RowId, vis: Version | undefined) {
  const tx = sess.tx!;
  for (let i = s.versions.length - 1; i >= 0; i--) {
    const v = s.versions[i];
    if (v.row !== row || v === vis || (vis && v.n < vis.n) || v.xmin === tx.xid) continue;
    const st = status(s, v.xmin);
    if (st === "in progress" && !tx.noted.dirty) {
      tx.noted.dirty = true;
      const owner = s.xactOwner[v.xmin];
      ctx.log("ok", `No dirty read: ${sess.label} sees ${row} = ${vis?.balance ?? "nothing"}, not the uncommitted ${v.balance}`, {
        detail: `xid ${v.xmin} (${owner === "setup" ? "setup" : sessionLabel(owner)}) is still in progress, so its row version is invisible to every other snapshot. ${
          tx.level === 0 ? "Even at READ UNCOMMITTED: in PostgreSQL it behaves like READ COMMITTED." : ""
        }`,
        node: HEAP,
      });
    } else if (st === "committed" && !tx.noted.stale && effectiveLevel(tx.level) >= REPEATABLE_READ) {
      tx.noted.stale = true;
      ctx.log("ok", `${sess.label} still sees ${row} = ${vis?.balance}: xid ${v.xmin} committed after its snapshot`, {
        detail: `Its snapshot ${snapText(tx.snapshot)} treats xid ${v.xmin} as not yet committed, for the whole transaction.`,
        node: HEAP,
      });
    }
    return;
  }
}

function readRow(s: State, ctx: Ctx, sess: Session, row: RowId, snap: Snap) {
  const tx = sess.tx!;
  const v = visibleVersion(s, row, snap, tx.xid);
  ssiRead(s, ctx, sess, row, [row]);
  noteSkipped(s, ctx, sess, row, v);
  const prevN = tx.reads[row];
  const prevVal = tx.readValues[row];
  if (v && prevN !== undefined && prevN !== v.n && v.xmin !== tx.xid && prevVal !== v.balance)
    ctx.log("warn", `Non-repeatable read: ${sess.label} read ${row} = ${prevVal}, now ${v.balance}`, {
      detail: `Same transaction, same query, different answer: another transaction committed in between, and ${LEVELS[tx.level]} gives every statement a new snapshot.`,
      node: sess.id,
    });
  if (v) {
    tx.reads[row] = v.n;
    tx.readValues[row] = v.balance;
  }
  finish(s, ctx, sess, { tag: v ? "SELECT 1" : "SELECT 0", result: v ? `balance = ${v.balance}` : "(0 rows)", value: v?.balance });
}

function readAll(s: State, ctx: Ctx, sess: Session, op: "select-all" | "sum", snap: Snap) {
  const tx = sess.tx!;
  const rows = ROWS.map((r) => ({ r, v: visibleVersion(s, r, snap, tx.xid) })).filter((x) => x.v);
  ssiRead(s, ctx, sess, "*", ROWS);
  for (const r of ROWS) noteSkipped(s, ctx, sess, r, rows.find((x) => x.r === r)?.v);
  if (op === "sum") {
    const sum = rows.reduce((a, x) => a + x.v!.balance, 0);
    return finish(s, ctx, sess, { tag: "SELECT 1", result: `sum = ${sum}`, sum });
  }
  // Non-repeatable rows and phantoms, against this transaction's previous SELECT *.
  const ids = rows.map((x) => x.r).join(",");
  for (const { r, v } of rows) {
    const prevN = tx.reads[r];
    if (prevN !== undefined && prevN !== v!.n && v!.xmin !== tx.xid && tx.readValues[r] !== v!.balance)
      ctx.log("warn", `Non-repeatable read: ${r} was ${tx.readValues[r]}, now ${v!.balance}`, {
        detail: `${sess.label} ran the same SELECT twice in one transaction. Another transaction committed in between, and ${LEVELS[tx.level]} gives every statement a new snapshot.`,
        node: sess.id,
      });
  }
  if (tx.scan !== null && tx.scan !== ids) {
    const added = ids.split(",").filter((r) => !tx.scan!.split(",").includes(r));
    ctx.log("warn", `Phantom read: ${sess.label}'s second SELECT * returned ${added.length ? `a new row, ${added.join(", ")}` : "a different set of rows"}`, {
      detail: "The set of rows matching the query changed because another transaction committed an INSERT in between.",
      node: sess.id,
    });
  }
  tx.scan = ids;
  for (const { r, v } of rows) {
    tx.reads[r] = v!.n;
    tx.readValues[r] = v!.balance;
  }
  finish(s, ctx, sess, { tag: `SELECT ${rows.length}`, result: rows.map((x) => `${x.r} ${x.v!.balance}`).join(", ") || "(0 rows)" });
}

function insertRow(s: State, ctx: Ctx, sess: Session, stmt: Extract<Stmt, { op: "insert" }>) {
  const tx = sess.tx!;
  if (s.versions.some((v) => v.row === stmt.row && status(s, v.xmin) !== "aborted" && (v.xmax === null || status(s, v.xmax) !== "committed")))
    return fail(s, ctx, sess, { code: "23505", message: `duplicate key value violates unique constraint "${TABLE}_pkey"` });
  ssiWrite(s, ctx, sess, stmt.row);
  const xid = assignXid(s, sess);
  s.versions.push({ n: s.nextN++, row: stmt.row, balance: stmt.balance, xmin: xid, xmax: null });
  tx.inserted[stmt.row] = stmt.balance;
  finish(s, ctx, sess, { tag: "INSERT 0 1" });
}

/** UPDATE and SELECT … FOR UPDATE: find the row, take its row lock (or wait), then write or return it. */
function lockAndWrite(s: State, ctx: Ctx, sess: Session, stmt: Extract<Stmt, { op: "update" } | { op: "select" }>, resumed: boolean) {
  const tx = sess.tx!;
  const level = effectiveLevel(tx.level);
  const row = stmt.row;
  const isUpdate = stmt.op === "update";
  // Read Committed re-checks the newest version after a wait; otherwise the snapshot decides.
  const orig = visibleVersion(s, row, tx.snapshot!, tx.xid);
  let target = level === READ_COMMITTED && resumed ? latestLive(s, row) : orig;
  if (target && target.xmax !== null && target.xmax !== tx.xid && status(s, target.xmax) === "committed" && level === READ_COMMITTED) target = undefined;
  if (!target) return finish(s, ctx, sess, { tag: isUpdate ? "UPDATE 0" : "SELECT 0", result: isUpdate ? "UPDATE 0" : "(0 rows)" });

  const lock = s.rowLocks[row];
  if (lock && lock.session !== sess.id && !s.sessions[lock.session].tx?.aborted) return startWait(s, ctx, sess, stmt, lock.xid, lock.session);

  const latest = latestLive(s, row)!;
  if (latest.n !== target.n && latest.xmin !== tx.xid) {
    if (level >= REPEATABLE_READ && s.components.writeCheck)
      return fail(s, ctx, sess, { code: "40001", message: "could not serialize access due to concurrent update" });
    target = latest; // write check removed: act like Read Committed and write on top
  }
  if (isUpdate) ssiWrite(s, ctx, sess, row);
  else ssiRead(s, ctx, sess, row, [row]);
  const xid = assignXid(s, sess);
  s.rowLocks[row] = { xid, session: sess.id, mode: isUpdate ? "FOR NO KEY UPDATE" : "FOR UPDATE" };

  const rechecked = resumed && level === READ_COMMITTED && !!orig && orig.n !== target.n;
  if (!isUpdate) {
    tx.reads[row] = target.n;
    tx.readValues[row] = target.balance;
    return finish(s, ctx, sess, { tag: "SELECT 1", result: `balance = ${target.balance} (locked)`, value: target.balance });
  }

  const upd = stmt as Extract<Stmt, { op: "update" }>;
  const value = upd.set !== undefined ? upd.set : target.balance + (upd.delta ?? 0);
  if (upd.set !== undefined && tx.reads[row] !== undefined && tx.reads[row] !== target.n && target.xmin !== tx.xid)
    tx.overwrote = { row, read: tx.readValues[row]!, over: target.balance, set: upd.set };
  target.xmax = xid;
  s.versions.push({ n: s.nextN++, row, balance: value, xmin: xid, xmax: null });
  tx.intended[row] = (tx.intended[row] ?? 0) + upd.intent;
  if (!s.flags.version) {
    s.flags.version = true;
    ctx.log("info", `${sess.label}'s UPDATE wrote a new version of ${row} (${value}, xmin ${xid})`, {
      detail: `PostgreSQL never updates in place: the old version (${target.balance}) gets xmax ${xid} and stays, so other snapshots can still read it. xid ${xid} also holds a row lock on ${row} until it ends.`,
      node: HEAP,
    });
  }
  if (rechecked)
    ctx.log(upd.set === undefined ? "ok" : "info", `${sess.label}'s UPDATE re-checked the new version of ${row} (${target.balance}) and wrote ${value}`, {
      detail:
        upd.set === undefined
          ? "Read Committed: after the wait, the UPDATE re-evaluates its WHERE clause on the updated row version and applies itself to it, so balance = balance + … builds on the other transaction's change."
          : `Read Committed: after the wait, the UPDATE applies itself to the updated row version. But SET balance = ${upd.set} is a literal the app computed from an older read, so it replaces ${target.balance} outright.`,
      node: HEAP,
    });
  finish(s, ctx, sess, { tag: "UPDATE 1" });
}

function startWait(s: State, ctx: Ctx, sess: Session, stmt: Stmt, xid: number, holder: SessionId) {
  const gen = ++s.waitGen;
  sess.wait = { xid, holder, row: (stmt as { row: RowId }).row, since: ctx.now, gen, stmt };
  const seg = sess.segs[sess.segs.length - 1];
  if (seg && seg.end === null) seg.end = ctx.now;
  sess.segs.push({ start: ctx.now, end: null, kind: "wait" });
  const h = s.sessions[holder];
  ctx.log("info", `${sess.label}'s ${verb(stmt)} waits: ${sess.wait.row} is locked by xid ${xid} (${h.label})`, {
    detail: `Row locks block only writers and lockers, never plain reads. pid ${sess.pid} waits for ShareLock on transaction ${xid} (pg_stat_activity: wait_event_type Lock, wait_event transactionid) until ${h.label} commits or rolls back.`,
    node: backendNode(sess.id),
  });
  // A wait cycle: say so (once) before the detector acts.
  if (h.wait?.holder === sess.id && !s.flags.cycle) {
    s.flags.cycle = true;
    ctx.log("warn", `Deadlock: ${sess.label} waits for ${h.label}, and ${h.label} waits for ${sess.label}`, {
      detail: s.components.deadlock
        ? `Neither can proceed. Nothing happens until a waiter has waited deadlock_timeout (${s.settings.deadlockTimeoutMs / 1000}s) and runs the deadlock check.`
        : "Neither can proceed, and the deadlock detector is removed: they wait forever, holding their locks.",
      node: LOCKS,
    });
  }
  if (s.components.deadlock) ctx.schedule(s.settings.deadlockTimeoutMs, { type: "deadlock-check", s: sess.id, gen });
}

function deadlockCheck(s: State, ctx: Ctx, sess: Session) {
  const cycle: Session[] = [sess];
  let cur = sess.wait ? s.sessions[sess.wait.holder] : null;
  while (cur && cur.id !== sess.id && cur.wait && !cycle.includes(cur)) {
    cycle.push(cur);
    cur = s.sessions[cur.wait.holder];
  }
  if (!cur || cur.id !== sess.id) return; // no cycle back to us: keep waiting
  s.deadlocks++;
  const detail = cycle
    .map((c) => `Process ${c.pid} waits for ShareLock on transaction ${c.wait!.xid}; blocked by process ${s.sessions[c.wait!.holder].pid}.`)
    .join("\n");
  ctx.log("error", `ERROR: deadlock detected. ${sess.label}'s transaction is aborted`, {
    detail: `${detail}\nSQLSTATE 40P01. After deadlock_timeout, pid ${sess.pid} checked the wait-for graph, found the cycle and aborted its own transaction, so the other can continue. Which one is aborted is not something to rely on.`,
    node: LOCKS,
  });
  endWait(sess, ctx);
  fail(s, ctx, sess, { code: "40P01", message: "deadlock detected", detail });
}

function endWait(sess: Session, ctx: Ctx) {
  sess.wait = null;
  const seg = sess.segs[sess.segs.length - 1];
  if (seg && seg.kind === "wait" && seg.end === null) {
    seg.end = ctx.now;
    sess.segs.push({ start: ctx.now, end: null, kind: "stmt" });
  }
}

/** Wake every session waiting on this one's transaction. */
function wakeWaiters(s: State, ctx: Ctx, ended: Session, committed: boolean) {
  for (const id of SESSIONS) {
    const w = s.sessions[id];
    if (!w.wait || w.wait.holder !== ended.id) continue;
    const stmt = w.wait.stmt;
    const row = w.wait.row;
    endWait(w, ctx);
    if (!committed)
      ctx.log("info", `${ended.label} ended without committing: ${w.label}'s ${verb(stmt)} gets the lock on ${row}`, {
        detail: "The changes it waited on were rolled back, so it proceeds with the row version it originally found.",
        node: backendNode(w.id),
      });
    runDml(s, ctx, w, stmt, true);
  }
}

function releaseLocks(s: State, sess: Session) {
  for (const r of ROWS) if (s.rowLocks[r]?.session === sess.id) delete s.rowLocks[r];
}

/** End the transaction: commit (already checked) or abort. */
function endTx(s: State, ctx: Ctx, sess: Session, committed: boolean, why?: string) {
  const tx = sess.tx!;
  if (tx.xid !== null) {
    s.xact[tx.xid] = committed ? "committed" : "aborted";
    s.latestCompleted = Math.max(s.latestCompleted, tx.xid);
  }
  const me = ssiOf(s, tx);
  if (me) {
    if (committed) {
      me.committed = true;
      me.commitSeq = ++s.commitSeq;
    } else me.aborted = true;
  } else if (committed) s.commitSeq++;
  if (committed) sess.commits++;
  else sess.aborts++;
  sess.tx = null;
  releaseLocks(s, sess);
  if (!committed && why && !tx.implicit)
    ctx.log("info", `${sess.label} rolled back${tx.xid !== null ? ` xid ${tx.xid}` : ""}`, {
      detail: tx.xid !== null ? `pg_xact marks ${tx.xid} aborted. Its row versions stay in the table but are invisible to everyone; its row locks are released.` : "It had written nothing, so it never got an xid.",
      node: XACT,
    });
  wakeWaiters(s, ctx, sess, committed);
  ssiCleanup(s);
  if (committed) afterCommit(s, ctx, sess, tx);
}

function commit(s: State, ctx: Ctx, sess: Session) {
  try {
    ssiPreCommit(s, ctx, sess);
  } catch (e) {
    if (e instanceof SqlError) return fail(s, ctx, sess, e.err);
    throw e;
  }
  const tx = sess.tx!;
  const implicit = tx.implicit;
  if (!implicit)
    ctx.log("ok", `${sess.label} committed${tx.xid !== null ? ` xid ${tx.xid}` : " (no xid: it wrote nothing)"}`, {
      detail:
        tx.xid !== null
          ? `pg_xact now says ${tx.xid} committed. That one status flip makes all its row versions visible to snapshots taken from now on, and releases its row locks.`
          : "It changed nothing, so it never needed a transaction ID.",
      node: XACT,
    });
  endTx(s, ctx, sess, true);
  finish(s, ctx, sess, { tag: "COMMIT" });
}

/** After a commit: did every change the apps intended survive? Does the household rule hold? */
function afterCommit(s: State, ctx: Ctx, sess: Session, tx: Tx) {
  for (const r of ROWS) {
    if (tx.inserted[r] !== undefined) s.expected[r] = tx.inserted[r];
    if (tx.intended[r] !== undefined && s.expected[r] !== undefined) s.expected[r]! += tx.intended[r]!;
  }
  for (const r of ROWS) {
    const actual = committedValue(s, r);
    const want = s.expected[r];
    if (want === undefined || actual === undefined || actual === want) continue;
    s.lostUpdates++;
    const o = tx.overwrote;
    ctx.log("error", `Lost update: ${r} is ${actual}, but the committed deposits add up to ${want}`, {
      detail: o
        ? `${sess.label} read ${r} = ${o.read}, computed ${o.set} in the app and wrote it as a literal over ${o.over}. The other transaction's change was silently overwritten. Both transactions committed without an error.`
        : "A committed change was overwritten by a write computed from an older read.",
      node: HEAP,
    });
    s.expected[r] = actual; // report once
  }
  const a = committedValue(s, "alice") ?? 0;
  const b = committedValue(s, "bob") ?? 0;
  if (a + b < 0 && !s.ruleBroken) {
    s.ruleBroken = true;
    ctx.log("error", `Rule broken: alice + bob = ${a + b}. Each withdrawal checked it, and both committed`, {
      detail: `Write skew: each transaction read both rows, saw 200, and changed a different row. Neither wrote what the other changed, so there was no write conflict. ${
        LEVELS[s.settings.isolation]
      } allows this serialization anomaly; Serializable doesn't.`,
      node: HEAP,
    });
  }
}

/** The current statement fails. Inside a transaction block the whole transaction is aborted. */
function fail(s: State, ctx: Ctx, sess: Session, err: NonNullable<Reply["error"]>) {
  const tx = sess.tx;
  if (err.code === "40001") {
    s.serializationFailures++;
    ctx.log("error", `ERROR: ${err.message}`, {
      detail:
        err.message === "could not serialize access due to concurrent update"
          ? `${sess.label} (${LEVELS[tx?.level ?? 2]}) tried to change ${"a row"} that another transaction changed and committed after its snapshot. It can't update a version it can't see, so it is rolled back. SQLSTATE 40001: the app should retry the whole transaction.`
          : `${err.detail ?? ""} SQLSTATE 40001. ${sess.label} is rolled back so that the committed result matches some serial order.`,
      node: sess.id,
    });
  }
  if (tx) {
    if (tx.xid !== null) {
      s.xact[tx.xid] = "aborted";
      s.latestCompleted = Math.max(s.latestCompleted, tx.xid);
    }
    const me = ssiOf(s, tx);
    if (me) me.aborted = true;
    tx.aborted = true;
    releaseLocks(s, sess);
    sess.aborts++;
    if (tx.implicit) sess.tx = null;
    wakeWaiters(s, ctx, sess, false);
    ssiCleanup(s);
  }
  finish(s, ctx, sess, { tag: "ERROR", error: err });
}

/** Statement done: reply to the client. */
function finish(s: State, ctx: Ctx, sess: Session, r: Reply) {
  const tx = sess.tx;
  if (tx?.implicit && !r.error && !tx.aborted) {
    // Autocommit: a statement outside BEGIN … COMMIT commits on its own.
    endTx(s, ctx, sess, true);
  }
  sess.backend = idleState(sess);
  reply(s, ctx, sess, r);
}

// ---------- user actions on the backend ----------

function cancelBackend(s: State, ctx: Ctx, sess: Session) {
  if (!sess.wait) return;
  endWait(sess, ctx);
  ctx.log("warn", `pg_cancel_backend(${sess.pid}): ${sess.label}'s waiting statement is cancelled`, {
    detail: "ERROR: canceling statement due to user request (SQLSTATE 57014). Inside a transaction block this aborts the whole transaction.",
    node: backendNode(sess.id),
  });
  fail(s, ctx, sess, { code: "57014", message: "canceling statement due to user request" });
}

function terminateBackend(s: State, ctx: Ctx, sess: Session) {
  if (!sess.connected) return;
  const tx = sess.tx;
  if (sess.wait) endWait(sess, ctx);
  ctx.log("warn", `pg_terminate_backend(${sess.pid}): ${sess.label}'s connection is closed`, {
    detail: `FATAL: terminating connection due to administrator command (SQLSTATE 57P01).${
      tx ? ` Its open transaction${tx.xid !== null ? ` (xid ${tx.xid})` : ""} is rolled back and its row locks are released.` : ""
    } The app reconnects and gets a new backend.`,
    node: backendNode(sess.id),
  });
  if (tx) {
    if (tx.xid !== null) {
      s.xact[tx.xid] = "aborted";
      s.latestCompleted = Math.max(s.latestCompleted, tx.xid);
    }
    const me = ssiOf(s, tx);
    if (me) me.aborted = true;
    sess.aborts++;
    sess.tx = null;
    releaseLocks(s, sess);
    wakeWaiters(s, ctx, sess, false);
    ssiCleanup(s);
  }
  s.packets = s.packets.filter((p) => p.from !== sess.id && p.to !== sess.id);
  sess.conn++;
  sess.connected = false;
  sess.busy = false;
  sess.backend = "idle";
  sess.mustRollback = null;
  if (sess.status === "running") sess.status = "failed";
  for (const seg of sess.segs)
    if (seg.end === null) {
      seg.end = ctx.now;
      seg.error = true;
    }
  for (const sp of sess.spans)
    if (sp.end === null) {
      sp.end = ctx.now;
      sp.outcome = "abort";
    }
  pushLine(sess, { sql: "FATAL: terminating connection due to administrator command", mark: "error", tone: "err" });
  ctx.schedule(RECONNECT_MS, { type: "reconnect", s: sess.id, conn: sess.conn });
}

// ---------- model ----------

function makeSession(id: SessionId, pid: number): Session {
  return {
    id,
    label: sessionLabel(id),
    pid,
    conn: 0,
    connected: true,
    tx: null,
    backend: "idle",
    wait: null,
    busy: false,
    program: null,
    step: 0,
    attempt: 0,
    status: "none",
    stalled: false,
    stepPending: false,
    stepGen: 0,
    saved: null,
    lastSum: null,
    pendingSet: null,
    mustRollback: null,
    lines: [],
    lineIdx: -1,
    segs: [],
    spans: [],
    lastError: null,
    commits: 0,
    aborts: 0,
    retries: 0,
  };
}

export const model: SimModel<State, Event, Action, Params> = {
  init(params, ctx) {
    const s: State = {
      settings: { ...params.settings },
      components: { ...params.components },
      versions: [
        { n: 1, row: "alice", balance: INITIAL.alice, xmin: SETUP_XID, xmax: null },
        { n: 2, row: "bob", balance: INITIAL.bob, xmin: SETUP_XID, xmax: null },
      ],
      nextN: 3,
      nextXid: SETUP_XID + 1,
      latestCompleted: SETUP_XID,
      xact: { [SETUP_XID]: "committed" },
      xactOwner: { [SETUP_XID]: "setup" },
      sessions: { A: makeSession("A", 4242), B: makeSession("B", 4243) },
      rowLocks: {},
      ssi: [],
      commitSeq: 0,
      nextTxKey: 1,
      expected: { ...INITIAL },
      lostUpdates: 0,
      ruleBroken: false,
      serializationFailures: 0,
      deadlocks: 0,
      waitGen: 0,
      packets: [],
      nextId: 1,
      flags: { version: false, rcSnapshot: false, noDetector: false, cycle: false },
    };
    ctx.log("info", `Table ${TABLE}: alice 100, bob 100. Sessions use ${LEVELS[s.settings.isolation]}`, {
      detail: `Both rows were written by xid ${SETUP_XID}, which committed. default_transaction_isolation is read committed unless changed; here each BEGIN asks for ${LEVELS[s.settings.isolation]}.`,
      node: HEAP,
    });
    return s;
  },

  handle(s, e, ctx) {
    const sess = s.sessions[e.s];
    switch (e.type) {
      case "step":
        if (e.conn !== sess.conn || e.gen !== sess.stepGen) return;
        return runStep(s, ctx, sess);
      case "stmt-arrive":
        dropPacket(s, e.packet);
        if (e.conn !== sess.conn) return;
        return onStmt(s, ctx, sess, e.stmt);
      case "reply-arrive":
        dropPacket(s, e.packet);
        if (e.conn !== sess.conn) return;
        return onReply(s, ctx, sess, e.reply);
      case "deadlock-check":
        if (sess.wait?.gen !== e.gen) return;
        return deadlockCheck(s, ctx, sess);
      case "retry":
        if (e.conn !== sess.conn || e.gen !== sess.stepGen || !sess.program) return;
        sess.attempt++;
        sess.retries++;
        ctx.log("info", `${sess.label}'s app retries the whole transaction (attempt ${sess.attempt})`, {
          detail: "PostgreSQL has no automatic retry. The app re-runs everything, including the reads its decisions were based on. The new attempt gets a new snapshot that includes what made it fail.",
          node: sess.id,
        });
        return startAttempt(s, ctx, sess);
      case "reconnect":
        if (e.conn !== sess.conn) return;
        sess.connected = true;
        sess.pid += 2;
        return;
    }
  },

  act(s, a, ctx) {
    const sess = s.sessions[a.s];
    switch (a.type) {
      case "run":
        if (!sess.connected || sess.busy || sess.tx || sess.mustRollback || (sess.status === "running" && sess.program)) return;
        sess.program = a.program;
        sess.attempt = 1;
        return startAttempt(s, ctx, sess);
      case "exec": {
        if (!sess.connected || sess.busy) return;
        if (sess.status === "running") sess.status = "failed"; // the user took over mid-program
        sess.program = null;
        sess.mustRollback = null;
        if (a.stmt.op === "begin") sess.lines = [];
        const i = pushLine(sess, { sql: sqlOf(a.stmt), mark: "pending" });
        return sendStmt(s, ctx, sess, a.stmt, i);
      }
      case "set-stalled":
        sess.stalled = a.on;
        if (a.on)
          ctx.log("warn", `${sess.label}'s app is stuck`, {
            detail: `It sends nothing more. Its backend sits "${idleState(sess)}"${sess.tx ? ", and its transaction keeps every row lock it holds" : ""}.`,
            node: sess.id,
          });
        if (!a.on && sess.stepPending) {
          sess.stepPending = false;
          scheduleStep(sess, ctx, 0);
        }
        return;
      case "cancel":
        return cancelBackend(s, ctx, sess);
      case "terminate":
        return terminateBackend(s, ctx, sess);
    }
  },
};

/** Every node the canvas draws: both sessions, their backends, the table, pg_xact and the lock table. */
export function nodeIds(): string[] {
  return ["A", "B", backendNode("A"), backendNode("B"), HEAP, XACT, LOCKS];
}

// ---------- read helpers for the views ----------

/** The snapshot a session's next read would use, for the "sees" markers: RR/SER's frozen one, or a fresh one. */
export function viewSnapshot(s: State, sess: Session): Snap | null {
  const tx = sess.tx;
  if (!tx || tx.aborted) return null;
  if (effectiveLevel(tx.level) >= REPEATABLE_READ) return tx.snapshot;
  return tx.snapshot ? takeSnapshot(s, tx.xid) : null;
}

export function txLevelText(sess: Session): string {
  return sess.tx ? LEVELS[sess.tx.level] : "";
}

export type { LogLevel };
