import type { Walkthrough } from "@/sims/explainers";

/**
 * What happens in each scenario, moment by moment, for the "How it works" page.
 * Times are simulated (slow-motion) milliseconds, as on the simulator's timeline.
 * Every moment with a `log` is checked by walkthroughs.test.ts: the model must narrate a
 * line containing that text within 0.4s of `t`. Text supports `code` and **bold**.
 */
export const walkthroughs: Walkthrough[] = [
  {
    id: "snapshots",
    setup:
      "Defaults: `READ COMMITTED`. Table `accounts` holds alice 100 and bob 100, both written by xid 739. At 1 s session A starts a transfer of 30 from alice to bob; at 1.8 s session B starts a report that runs `SELECT sum(balance) FROM accounts` twice.",
    moments: [
      { t: 0, log: "Table accounts: alice 100, bob 100", text: "Each row has a single version: `xmin 739`, `xmax` empty." },
      {
        t: 2580,
        log: "Session A's UPDATE wrote a new version of alice (70, xmin 740)",
        text: "A's first write gets it xid 740. The old version of alice keeps its 100 and gets `xmax 740`; a new version with 70 and `xmin 740` sits next to it. In pg_xact, 740 is in progress.",
      },
      {
        t: 3420,
        log: "No dirty read: Session B sees alice = 100, not the uncommitted 70",
        text: "B's sum runs in the middle of the transfer. Its snapshot lists 740 as not yet visible, so it reads the old versions and gets 200. It didn't wait for A's row lock: reads never do.",
      },
      {
        t: 7090,
        log: "Session A committed xid 740",
        text: "A's `COMMIT` changes one thing: 740 is committed in pg_xact. The old versions are now dead (struck through); nothing in the table was rewritten.",
      },
      { t: 8200, text: "B's second sum takes a new snapshot that counts 740, so it reads alice 70 and bob 130: still 200." },
      { t: 9710, log: "Session B committed (no xid: it wrote nothing)", text: "B never wrote anything, so it never needed an xid." },
    ],
    takeaway:
      "An UPDATE adds a row version instead of overwriting, and a snapshot picks which version each statement sees. That is why a reader never waits for a writer and never sees half a transaction.",
    tryNext: [
      "Select **Session B** and press **Report: total money, twice** while A is mid-transfer.",
      "Set **Isolation level** to `REPEATABLE READ` in **Blocks & settings**: B's second sum now uses its first snapshot.",
    ],
  },
  {
    id: "read-uncommitted",
    setup:
      "**Isolation level** `READ UNCOMMITTED`. A charges alice 30 at 2.3 s and rolls back 4 s later. B reads alice in between.",
    moments: [
      {
        t: 1310,
        log: "Session A: BEGIN ISOLATION LEVEL READ UNCOMMITTED runs as READ COMMITTED",
        text: "PostgreSQL accepts the level and runs the transaction as `READ COMMITTED`.",
      },
      { t: 2620, log: "Session A's UPDATE wrote a new version of alice (70, xmin 740)", text: "A's uncommitted version of alice (70) is in the table." },
      {
        t: 4200,
        log: "No dirty read: Session B sees alice = 100, not the uncommitted 70",
        text: "B's `SELECT` returns 100. A real dirty read would have returned 70, a value that is about to disappear.",
      },
      {
        t: 7390,
        log: "Session A rolled back xid 740",
        text: "pg_xact marks 740 aborted. The 70 version stays in the table but is dead to everyone; the 100 version's `xmax 740` is ignored because 740 aborted.",
      },
    ],
    takeaway: "In PostgreSQL, no isolation level lets you read uncommitted data. Read Uncommitted is accepted for compatibility and behaves like Read Committed.",
    tryNext: ["Select **Session A**, press **BEGIN READ UNCOMMITTED** and **UPDATE alice + 10**, then read alice from **Session B** by hand."],
  },
  {
    id: "non-repeatable",
    setup:
      "Defaults (`READ COMMITTED`). At 1 s B starts a transaction that runs `SELECT * FROM accounts` twice, 6 s apart. At 3 s A charges alice 30 and inserts carol with 50, then commits.",
    moments: [
      {
        t: 2620,
        log: "Session B's statement takes a new snapshot, 740:740:",
        text: "B's first `SELECT *` gets its own snapshot and returns alice 100, bob 100.",
      },
      { t: 4570, log: "Session A's UPDATE wrote a new version of alice (70, xmin 740)", text: "A writes a new version of alice, then inserts carol." },
      { t: 7580, log: "Session A committed xid 740", text: "A commits while B's transaction is still open." },
      {
        t: 9250,
        log: "Non-repeatable read: alice was 100, now 70",
        text: "B's second `SELECT *` takes a new snapshot, which counts 740. Same query, same transaction, and alice has changed.",
      },
      { t: 9250, log: "Phantom read: Session B's second SELECT * returned a new row, carol", text: "And there is a row that wasn't there before: carol." },
    ],
    takeaway: "Read Committed gives each statement its own snapshot, so a transaction that reads twice can see other transactions' commits in between: nonrepeatable reads and phantoms.",
    tryNext: [
      "Set **Isolation level** to `REPEATABLE READ` and replay: both reads return the same two rows.",
      "Select **Session A** and run **Charge alice 30, open carol's account** while B's transaction is open.",
    ],
  },
  {
    id: "lost-update",
    setup:
      "Defaults (`READ COMMITTED`). A deposits 50 and B deposits 30 into alice. Each app reads the balance with `SELECT`, adds in its own code, and writes the result with `UPDATE accounts SET balance = $1`.",
    moments: [
      { t: 2900, text: "A reads alice = 100. At 3.2 s B reads alice = 100 too: neither has written yet." },
      {
        t: 4110,
        log: "Session A's UPDATE wrote a new version of alice (150, xmin 740)",
        text: "A sends `SET balance = 150`. Its xid 740 now holds the row lock on alice (`FOR NO KEY UPDATE`).",
      },
      {
        t: 4710,
        log: "Session B's UPDATE waits: alice is locked by xid 740 (Session A)",
        text: "B sends `SET balance = 130`. The row is locked, so B's backend waits: `wait_event` `transactionid`.",
      },
      {
        t: 6330,
        log: "Session B's UPDATE re-checked the new version of alice (150) and wrote 130",
        text: "A commits. B's `UPDATE` wakes, re-checks its `WHERE` on the new version (150) and applies to it, but its literal replaces 150 with 130.",
      },
      {
        t: 7820,
        log: "Lost update: alice is 130, but the committed deposits add up to 180",
        text: "B commits. Both transactions succeeded, nobody got an error, and A's 50 is gone.",
      },
    ],
    takeaway:
      "Read Committed protects a single UPDATE (it waits and re-checks), not a value the app read earlier. Compute in SQL (`balance = balance + 30`), lock what you read with `SELECT … FOR UPDATE`, or use Repeatable Read.",
    tryNext: [
      "Select **Session A** and run **Deposit 30 with SELECT … FOR UPDATE**, then quickly the same in **Session B**: B's read waits for A's lock, and alice ends at 160.",
      "Set **Isolation level** to `REPEATABLE READ` and replay.",
    ],
  },
  {
    id: "first-updater-wins",
    setup: "The same two deposits, at **Isolation level** `REPEATABLE READ`. The app retries on SQLSTATE 40001 (the **Retry on 40001 and 40P01** block).",
    moments: [
      {
        t: 3220,
        log: "Session B's transaction snapshot is 740:740:",
        text: "B's snapshot is taken at its first `SELECT` (not at `BEGIN`) and kept for the whole transaction.",
      },
      { t: 4710, log: "Session B's UPDATE waits: alice is locked by xid 740 (Session A)", text: "B's `UPDATE` waits for A's row lock, as before." },
      {
        t: 6330,
        log: "ERROR: could not serialize access due to concurrent update",
        text: "A commits. The newest version of alice was written by a transaction B's snapshot doesn't see, so B can't update it: SQLSTATE 40001.",
      },
      {
        t: 8420,
        log: "Session B's app retries the whole transaction (attempt 2)",
        text: "The app sends `ROLLBACK`, then re-runs the whole deposit, including the read.",
      },
      { t: 10010, log: "Session B's transaction snapshot is 741:741:", text: "The new snapshot counts A's commit: B reads 150 and writes 180." },
      { t: 13010, log: "Session B committed xid 741", text: "alice is 180. Both deposits survived." },
    ],
    takeaway: "At Repeatable Read the second writer to a row loses with 40001 instead of silently overwriting. That only helps if the application retries the whole transaction.",
    tryNext: [
      "Remove **Retry on 40001 and 40P01** in **Blocks & settings**: the error reaches the user and B's deposit never happens.",
      "Remove **Repeatable Read write check**: the lost update comes back.",
    ],
  },
  {
    id: "write-skew",
    setup:
      "**Isolation level** `REPEATABLE READ`. The household rule is alice + bob ≥ 0. A withdraws 150 from alice and B withdraws 150 from bob; each first checks `SELECT sum(balance) FROM accounts`.",
    moments: [
      { t: 2610, log: "Session A's transaction snapshot is 740:740:", text: "A's sum returns 200, so its check passes: 200 - 150 ≥ 0." },
      { t: 2910, log: "Session B's transaction snapshot is 740:740:", text: "B's sum, from its own snapshot, is also 200. Its check passes too." },
      {
        t: 4120,
        log: "Session A's UPDATE wrote a new version of alice (-50, xmin 740)",
        text: "A writes alice, B writes bob. Different rows: no lock wait and no write conflict.",
      },
      { t: 6130, log: "Session A committed xid 740", text: "A commits." },
      {
        t: 6410,
        log: "Rule broken: alice + bob = -100",
        text: "B commits too. Each transaction was correct on its own; together they produced a state no serial order would.",
      },
    ],
    takeaway: "Repeatable Read stops two writers on one row, not two writers whose decisions depend on each other's rows. That is write skew, a serialization anomaly.",
    tryNext: ["Set **Isolation level** to `SERIALIZABLE` and replay.", "Remove **SSI (Serializable checks)** at `SERIALIZABLE`: the rule breaks again."],
  },
  {
    id: "serializable",
    setup: "The same two withdrawals at **Isolation level** `SERIALIZABLE`, with the retry block in place.",
    moments: [
      {
        t: 2610,
        text: "Each sum scans the whole table, so each transaction takes a relation-level SIRead lock. They block nothing; they record what was read.",
      },
      {
        t: 4120,
        log: "SSI records an rw-conflict: Session B → Session A",
        text: "A's `UPDATE` of alice hits B's SIRead lock: B read alice without seeing this change, so B must come before A.",
      },
      {
        t: 4400,
        log: "SSI records an rw-conflict: Session A → Session B",
        text: "B's `UPDATE` of bob hits A's SIRead lock: A must come before B. That is a cycle in the making.",
      },
      {
        t: 6130,
        log: "SSI dooms Session B: committing Session A completes a cycle",
        text: "A commits first. B has a conflict in and a conflict out (a pivot), so it is marked to fail.",
      },
      {
        t: 6410,
        log: "ERROR: could not serialize access due to read/write dependencies among transactions",
        text: "B's `COMMIT` fails with SQLSTATE 40001, `Reason code: Canceled on identification as a pivot, during commit attempt.`",
      },
      {
        t: 10790,
        log: "Session B's app refuses the withdrawal: the household would go to -100",
        text: "B's retry gets a new snapshot that includes A's withdrawal: the sum is 50, and its own check refuses. The rule holds.",
      },
    ],
    takeaway: "Serializable is Repeatable Read plus non-blocking tracking of who read what. When the result could match no serial order, one transaction fails with 40001, and its retry sees the real state.",
    tryNext: ["Remove **Retry on 40001 and 40P01**: B's withdrawal simply fails.", "Select **locks** while it runs to watch the SIRead locks and rw-conflicts."],
  },
  {
    id: "deadlock",
    setup:
      "Defaults (`READ COMMITTED`, `deadlock_timeout` 1 s). A transfers 30 alice → bob; B transfers 20 bob → alice, so they lock the same two rows in opposite order.",
    moments: [
      { t: 2580, log: "Session A's UPDATE wrote a new version of alice (70, xmin 740)", text: "A locks alice. At 3.1 s B locks bob." },
      { t: 5050, log: "Session B's UPDATE waits: alice is locked by xid 740 (Session A)", text: "B now wants alice and waits for A." },
      {
        t: 5580,
        log: "Deadlock: Session A waits for Session B, and Session B waits for Session A",
        text: "A wants bob and waits for B. Neither can proceed, but nothing happens yet: no one checks until `deadlock_timeout` has passed.",
      },
      {
        t: 6050,
        log: "ERROR: deadlock detected. Session B's transaction is aborted",
        text: "B has waited 1 s, so it runs the check, finds the cycle and aborts its own transaction: SQLSTATE 40P01, `Process 4243 waits for ShareLock on transaction 740; blocked by process 4242.`",
      },
      { t: 7510, log: "Session A committed xid 740", text: "B's locks are gone, so A's `UPDATE` of bob goes through and A commits." },
      { t: 13160, log: "Session B committed xid 742", text: "B's app retried the transfer from the start and it went through." },
    ],
    takeaway: "Deadlocks come from taking the same locks in different orders. PostgreSQL breaks them after deadlock_timeout by aborting one transaction, which the app should retry; updating rows in a consistent order avoids them.",
    tryNext: ["Remove **Deadlock detector**: both sessions wait forever.", "Select a waiting backend and press **pg_cancel_backend(4243)** before the timer runs out."],
  },
];
