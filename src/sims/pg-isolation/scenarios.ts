import type { Scenario } from "@/sims/types";
import { REPEATABLE_READ, SERIALIZABLE, type Action, type Components, type Settings } from "./model";

/** Every scenario runs for this long; the session cards' timelines span exactly this. */
export const RUN_MS = 20_000;

const run = (at: number, s: "A" | "B", program: string): { at: number; action: Action } => ({ at, action: { type: "run", s, program } });

export const scenarios: Scenario<Action, Settings, Components>[] = [
  {
    id: "snapshots",
    title: "Row versions and snapshots: the happy path",
    summary:
      "Read Committed, the default. Session A transfers 30 from alice to bob while session B adds up all balances, twice. B never waits for A and never sees half a transfer.",
    watchFor: [
      "A's UPDATE doesn't overwrite alice: it adds a new row version (xmin = A's xid) and stamps the old one with xmax.",
      "B's first sum runs while A is in progress and still gets 200, from the old versions.",
      "After A's COMMIT flips its xid to committed in pg_xact, B's next statement sees the new versions.",
    ],
    duration: RUN_MS,
    script: [run(1000, "A", "transfer"), run(1800, "B", "report")],
    select: "heap",
    flow: [
      { at: 0, nodes: ["heap"], note: "Two rows, each a single version written by xid 739." },
      { at: 2300, nodes: ["A", "be:A", "heap"], note: "A's UPDATE adds a new version of alice; the old one gets xmax = A's xid." },
      { at: 3100, nodes: ["B", "be:B", "heap"], note: "B sums the balances while A is in progress: it reads the old versions, 200." },
      { at: 6700, nodes: ["A", "be:A", "xact"], note: "A commits: pg_xact marks its xid committed. Nothing in the table is rewritten." },
      { at: 7800, nodes: ["B", "be:B", "heap"], note: "B's second sum takes a new snapshot and sees the new versions: still 200." },
    ],
  },
  {
    id: "read-uncommitted",
    title: "READ UNCOMMITTED still never reads dirty data",
    summary:
      "Both sessions ask for READ UNCOMMITTED. A charges alice 30 and later rolls back. B reads alice in between. In PostgreSQL that level behaves like READ COMMITTED, so B never sees a value that was never committed.",
    watchFor: [
      "B's SELECT returns 100, the committed version, while A's 70 sits in the table uncommitted.",
      "A's ROLLBACK marks its xid aborted; its row version stays in the table, invisible to everyone.",
    ],
    settings: { isolation: 0 },
    duration: RUN_MS,
    script: [run(1000, "A", "charge-then-undo"), run(2600, "B", "read-alice")],
    select: "heap",
    flow: [
      { at: 0, nodes: ["A", "B"], note: "Both sessions will BEGIN ISOLATION LEVEL READ UNCOMMITTED." },
      { at: 2300, nodes: ["A", "be:A", "heap"], note: "A writes alice = 70 and doesn't commit yet." },
      { at: 3900, nodes: ["B", "be:B", "heap"], note: "B reads alice: it gets 100. A dirty read would have returned 70." },
      { at: 7000, nodes: ["A", "be:A", "xact", "heap"], note: "A rolls back. Its version of alice is dead: xmin points to an aborted xid." },
    ],
  },
  {
    id: "non-repeatable",
    title: "Read Committed: non-repeatable reads and phantoms",
    summary:
      "B reads every account twice in one transaction. In between, A charges alice and opens carol's account, and commits. B's second SELECT sees both changes, because each statement gets a new snapshot.",
    watchFor: [
      "B's two snapshots differ: the second one includes A's xid.",
      "alice changes from 100 to 70 between the two reads (non-repeatable read).",
      "carol appears in the second read (phantom read).",
    ],
    duration: RUN_MS,
    script: [run(1000, "B", "read-twice"), run(3000, "A", "edit-accounts")],
    select: "B",
    flow: [
      { at: 0, nodes: ["B", "be:B", "heap"], note: "B reads every account: alice 100, bob 100." },
      { at: 4300, nodes: ["A", "be:A", "heap"], note: "A charges alice 30 and inserts carol, then commits." },
      { at: 8800, nodes: ["B", "be:B", "heap"], note: "B's second SELECT takes a new snapshot: alice is 70 and carol exists." },
    ],
  },
  {
    id: "lost-update",
    title: "Lost update: read, add in the app, write back",
    summary:
      "Two deposits to alice, 50 and 30. Each app reads the balance, adds in its own code and writes the result as a literal. At Read Committed, B's UPDATE waits for A's row lock, then overwrites A's deposit.",
    watchFor: [
      "Both sessions read alice = 100 before either writes.",
      "B's UPDATE waits for A's row lock, then applies to A's new version, but with the literal 130.",
      "Both commit without an error, and alice ends at 130 instead of 180.",
    ],
    duration: RUN_MS,
    script: [run(1000, "A", "deposit-50"), run(1600, "B", "deposit-30")],
    select: "heap",
    flow: [
      { at: 0, nodes: ["A", "B", "heap"], note: "Each deposit reads alice, adds in the app, then writes the result back." },
      { at: 2200, nodes: ["A", "B", "heap"], note: "Both read alice = 100." },
      { at: 3700, nodes: ["A", "be:A", "heap", "locks"], note: "A writes 150 and holds alice's row lock." },
      { at: 4400, nodes: ["B", "be:B", "locks"], note: "B's UPDATE waits for A's transaction to end." },
      { at: 6200, nodes: ["B", "be:B", "heap"], note: "A commits. B's UPDATE goes on, and writes its literal 130 over 150." },
      { at: 7700, nodes: ["B", "heap", "xact"], note: "B commits. A's deposit of 50 is gone, and nobody got an error." },
    ],
  },
  {
    id: "first-updater-wins",
    title: "Repeatable Read: the second writer fails and retries",
    summary:
      "The same two deposits at REPEATABLE READ. B's UPDATE waits for A's row lock as before, but once A commits, B can't update a version newer than its snapshot: it gets SQLSTATE 40001 and the app retries.",
    watchFor: [
      "B's UPDATE fails with could not serialize access due to concurrent update.",
      "The app rolls back and re-runs the whole deposit; the new snapshot sees 150.",
      "alice ends at 180: neither deposit is lost.",
    ],
    settings: { isolation: REPEATABLE_READ },
    duration: RUN_MS,
    script: [run(1000, "A", "deposit-50"), run(1600, "B", "deposit-30")],
    select: "B",
    flow: [
      { at: 0, nodes: ["A", "B", "heap"], note: "Same deposits, now at REPEATABLE READ: one snapshot per transaction." },
      { at: 4400, nodes: ["B", "be:B", "locks"], note: "B's UPDATE waits for A's row lock, as at Read Committed." },
      { at: 6200, nodes: ["B", "be:B", "heap"], note: "A committed a version B's snapshot can't see: B's UPDATE fails with 40001." },
      { at: 7300, nodes: ["B", "be:B"], note: "The app rolls back and retries the whole transaction with a new snapshot." },
      { at: 9500, nodes: ["B", "heap"], note: "This time B reads 150 and writes 180. Both deposits survive." },
    ],
  },
  {
    id: "write-skew",
    title: "Write skew: both checks pass, the rule breaks",
    summary:
      "The bank's rule: alice + bob must stay ≥ 0. A withdraws 150 from alice and B withdraws 150 from bob, each after checking the sum. At REPEATABLE READ both see 200, write different rows, and commit.",
    watchFor: [
      "Both sums return 200 from their snapshots; both app checks pass.",
      "The UPDATEs touch different rows, so there is no row lock wait and no write conflict.",
      "After both commit, alice + bob = -100.",
    ],
    settings: { isolation: REPEATABLE_READ },
    duration: RUN_MS,
    script: [run(1000, "A", "withdraw-alice"), run(1300, "B", "withdraw-bob")],
    select: "heap",
    flow: [
      { at: 0, nodes: ["A", "B", "heap"], note: "Each withdrawal checks alice + bob first. Watch both sums." },
      { at: 2300, nodes: ["A", "B", "be:A", "be:B"], note: "Both sums return 200: each check passes." },
      { at: 3700, nodes: ["A", "B", "heap", "locks"], note: "A writes alice, B writes bob. Different rows: no lock conflict." },
      { at: 5700, nodes: ["A", "B", "xact", "heap"], note: "Both commit. Each was fine alone; together they broke the rule." },
    ],
  },
  {
    id: "serializable",
    title: "Serializable: SSI cancels one withdrawal",
    summary:
      "The same two withdrawals at SERIALIZABLE. Their sums leave SIRead locks; each UPDATE hits the other's, recording rw-conflicts in both directions. When A commits, B is the pivot of a cycle and its COMMIT fails with 40001. On retry its check sees the truth.",
    watchFor: [
      "SIRead locks on the whole table, one per transaction, in the lock table.",
      "Two rw-conflicts: A → B and B → A.",
      "B's COMMIT fails with could not serialize access due to read/write dependencies among transactions.",
      "B's retry reads sum = 50, and its app refuses the withdrawal.",
    ],
    settings: { isolation: SERIALIZABLE },
    duration: RUN_MS,
    script: [run(1000, "A", "withdraw-alice"), run(1300, "B", "withdraw-bob")],
    select: "locks",
    flow: [
      { at: 0, nodes: ["A", "B", "locks"], note: "SERIALIZABLE: reads leave SIRead locks. Watch the lock table." },
      { at: 2300, nodes: ["be:A", "be:B", "locks"], note: "Each sum scans the table, so each takes a relation-level SIRead lock." },
      { at: 3700, nodes: ["A", "B", "locks"], note: "Each UPDATE hits the other's SIRead lock: rw-conflicts in both directions." },
      { at: 5700, nodes: ["A", "B", "locks", "xact"], note: "A commits first. B is the pivot of a cycle: its COMMIT fails with 40001." },
      { at: 7700, nodes: ["B", "be:B", "heap"], note: "B retries. Its new sum is 50, so its own check refuses. The rule holds." },
    ],
  },
  {
    id: "deadlock",
    title: "Deadlock: two transfers in opposite order",
    summary:
      "A moves money alice → bob, B moves money bob → alice. Each locks its first row, then waits for the other's. After deadlock_timeout the waiting backend checks, finds the cycle and aborts its own transaction; the app retries.",
    watchFor: [
      "Two waits in the lock table, pointing at each other.",
      "Nothing happens until deadlock_timeout passes.",
      "ERROR: deadlock detected (40P01) for one session; the other completes, then the first retries.",
    ],
    duration: RUN_MS,
    script: [run(1000, "A", "transfer"), run(1500, "B", "transfer-back")],
    select: "locks",
    flow: [
      { at: 0, nodes: ["A", "B", "locks"], note: "A updates alice then bob. B updates bob then alice." },
      { at: 2300, nodes: ["be:A", "be:B", "locks"], note: "Each takes the row lock on its first row." },
      { at: 4600, nodes: ["be:A", "be:B", "locks"], note: "Each now waits for the other's lock: a cycle. Watch the deadlock_timeout timer." },
      { at: 5900, nodes: ["B", "be:B", "locks"], note: "B's check finds the cycle: ERROR deadlock detected, B's transaction is aborted." },
      { at: 6200, nodes: ["A", "be:A", "xact"], note: "A gets bob's lock and commits. B retries and goes through." },
    ],
  },
];
