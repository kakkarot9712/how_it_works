import { AnnotatedConfig, Callout, citer, Compare, Figure, Prose, ServerOutput, TryIt, WriteupSection } from "@/components/writeup";
import type { WriteupMeta } from "@/sims/explainers";
import { scenarios } from "../scenarios";
import { sources } from "../sources";
import { VersionDiagram } from "./VersionDiagram";

export const meta: WriteupMeta = {
  title: "How PostgreSQL transaction isolation actually works",
  lede: "PostgreSQL never overwrites a row: every UPDATE writes a new version, and a snapshot decides which version each statement sees. Isolation levels differ in when that snapshot is taken and what happens when two transactions write the same data.",
  facts: [
    { label: "Default level", value: "READ COMMITTED" },
    { label: "Mechanism", value: "MVCC snapshots" },
    { label: "Readers block writers", value: "never" },
    { label: "Errors to retry", value: "40001, 40P01" },
  ],
  sections: [
    { id: "path", title: "The life of one UPDATE" },
    { id: "levels", title: "Four levels, three behaviours" },
    { id: "read-committed", title: "Read Committed" },
    { id: "repeatable-read", title: "Repeatable Read" },
    { id: "serializable", title: "Write skew and Serializable" },
    { id: "locks", title: "Row locks and deadlocks" },
    { id: "errors", title: "Errors and retries" },
    { id: "alternatives", title: "Choosing a level" },
    { id: "simplifies", title: "What this simulation simplifies" },
  ],
};

/** Scenario links by id, numbered as in the simulator's picker. */
function see(...ids: string[]) {
  return ids.map((id) => {
    const i = scenarios.findIndex((s) => s.id === id);
    if (i < 0) throw new Error(`Explainer links to unknown scenario "${id}"`);
    return { id, n: i + 1, title: scenarios[i].title };
  });
}

const cite = citer(sources);

/** Long-form write-up for /transactions/isolation-levels/how-it-works (server component). */
export function Explainer({ simHref }: { simHref: string }) {
  return (
    <Prose>
      <WriteupSection id="path" title="The life of one UPDATE">
        <p>
          PostgreSQL keeps data consistent under concurrency with multiversion concurrency control (MVCC): each SQL statement sees a
          snapshot of the data as it was at some point, whatever has happened to the rows since. Because reads use snapshots
          instead of locks, reading never blocks writing and writing never blocks reading, even at the strictest isolation level.
          {cite("mvcc-intro")}
        </p>
        <p>
          Every row version carries two hidden columns. <code>xmin</code> is the transaction ID (xid) that inserted it, and{" "}
          <code>xmax</code> is the xid that deleted it, or zero. Each update of a row creates a new version of the same logical row,
          so an <code>UPDATE</code> sets <code>xmax</code> on the old version and inserts a new one. A nonzero <code>xmax</code> on a
          visible version usually means the deleting transaction hasn&apos;t committed yet, or rolled back.{cite("system-columns")}
        </p>
        <Figure
          caption={
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Session A runs <code className="font-mono text-fg">UPDATE accounts SET balance = balance - 30 WHERE id = &apos;alice&apos;</code>{" "}
                as xid 740. The old version (100) gets <code className="font-mono text-fg">xmax 740</code>; a new version (70) has{" "}
                <code className="font-mono text-fg">xmin 740</code>. The server replies with the command tag{" "}
                <code className="font-mono text-fg">UPDATE 1</code>.{cite("system-columns", "protocol")}
              </li>
              <li>
                The commit status of every xid lives in <code className="font-mono text-fg">pg_xact</code>: in progress, committed
                or aborted.{cite("file-layout", "functions-info")}
              </li>
              <li>
                A snapshot, written <code className="font-mono text-fg">xmin:xmax:xip_list</code>, says which xids count: those
                below its xmin are finished, those from its xmax on are invisible, and those listed were still in progress. A
                version is visible if its <code className="font-mono text-fg">xmin</code> committed and counts for the snapshot,
                and its <code className="font-mono text-fg">xmax</code> doesn&apos;t.{cite("functions-info")}
              </li>
            </ol>
          }
        >
          <VersionDiagram />
        </Figure>
        <p>
          So a commit doesn&apos;t rewrite anything in the table: it changes the xid&apos;s status, and snapshots taken from then on
          count it. A transaction that only reads may never be assigned an xid at all.{cite("functions-info")}
        </p>
        <TryIt simHref={simHref} items={see("snapshots")} />
      </WriteupSection>

      <WriteupSection id="levels" title="Four levels, three behaviours">
        <p>
          The SQL standard defines four isolation levels by which phenomena they must prevent: a <em>dirty read</em> (reading
          another transaction&apos;s uncommitted data), a <em>nonrepeatable read</em> (re-reading a row and finding another
          transaction changed and committed it), a <em>phantom read</em> (re-running a query and getting a different set of rows),
          and a <em>serialization anomaly</em> (a result that no one-at-a-time order of the transactions could produce).
          {cite("transaction-iso")}
        </p>
        <Compare
          head={["Level", "Dirty read", "Nonrepeatable read", "Phantom read", "Serialization anomaly"]}
          rows={[
            ["Read uncommitted", "Allowed, but not in PostgreSQL", "Possible", "Possible", "Possible"],
            ["Read committed", "Not possible", "Possible", "Possible", "Possible"],
            ["Repeatable read", "Not possible", "Not possible", "Allowed, but not in PostgreSQL", "Possible"],
            ["Serializable", "Not possible", "Not possible", "Not possible", "Not possible"],
          ]}
        />
        <p>
          PostgreSQL accepts all four but implements three: Read Uncommitted behaves like Read Committed, the only sensible mapping
          onto MVCC. Its Repeatable Read also prevents phantoms, which the standard allows because it only sets minimum
          protections.{cite("transaction-iso")}
        </p>
        <AnnotatedConfig
          parts={[
            { token: "BEGIN", label: "start a block" },
            { token: "ISOLATION LEVEL", label: "transaction_mode" },
            { token: "REPEATABLE READ", label: "one of four", tone: "accent" },
          ]}
        />
        <p>
          The level is chosen per transaction, with <code>BEGIN ISOLATION LEVEL …</code> or <code>SET TRANSACTION</code>, and it
          can&apos;t change after the transaction&apos;s first query or data-modification statement.{cite("set-transaction", "begin")}{" "}
          Without either, a transaction uses <code>default_transaction_isolation</code>, which defaults to read committed.
          {cite("default-isolation")}
        </p>
        <TryIt simHref={simHref} items={see("read-uncommitted")} />
      </WriteupSection>

      <WriteupSection id="read-committed" title="Read Committed: a snapshot per statement">
        <p>
          At Read Committed, a <code>SELECT</code> sees only data committed before that query began, plus the transaction&apos;s own
          changes. Two <code>SELECT</code>s in one transaction can see different data if others commit in between: nonrepeatable
          reads and phantoms are both possible.{cite("transaction-iso")} In the simulator, a row that session A adds with{" "}
          <code>INSERT INTO accounts VALUES (&apos;carol&apos;, 50)</code> appears in session B&apos;s second <code>SELECT *</code>.
          {cite("sql-insert")}
        </p>
        <p>
          Writes are different. An <code>UPDATE</code> finds its target rows with the same kind of snapshot, but if a target row
          was already updated or locked by a concurrent transaction, it waits for that transaction. If it rolls back, the update
          proceeds on the row it found. If it commits, the <code>WHERE</code> clause is re-evaluated on the <em>updated</em>{" "}
          version, and the update applies to that version.{cite("transaction-iso")}
        </p>
        <p>
          That re-check is why <code>SET balance = balance + 30</code> is safe here: it builds on the other transaction&apos;s change.
          It is also why read-then-write in the application is not. If the app reads 100, adds 30 in its own code and sends{" "}
          <code>SET balance = 130</code>, the re-check finds the updated row and overwrites it with 130: a lost update, with no
          error anywhere. The PostgreSQL docs warn that business rules are very difficult to enforce at Read Committed, because the
          view of the data shifts with each statement; <code>SELECT … FOR UPDATE</code> locks the rows you read against
          concurrent updates.{cite("applevel")}
        </p>
        <TryIt simHref={simHref} items={see("non-repeatable", "lost-update")} />
      </WriteupSection>

      <WriteupSection id="repeatable-read" title="Repeatable Read: one snapshot, first updater wins">
        <p>
          A Repeatable Read transaction sees a snapshot taken at the start of its first statement that isn&apos;t transaction
          control (so not at <code>BEGIN</code>), and keeps it to the end. Successive <code>SELECT</code>s see the same data. This is
          the technique known as snapshot isolation.{cite("transaction-iso")}
        </p>
        <p>
          When an <code>UPDATE</code> finds a target row that a concurrent transaction changed, it waits like Read Committed does.
          But if that transaction commits (and really updated or deleted the row, not just locked it), the Repeatable Read
          transaction is rolled back with:{cite("transaction-iso", "modify-table")}
        </p>
        <ServerOutput>ERROR:  could not serialize access due to concurrent update</ServerOutput>
        <p>
          It can&apos;t modify a row version its snapshot doesn&apos;t see. The application should retry the whole transaction; the
          second time, the committed change is part of the new snapshot.{cite("transaction-iso")} The error always carries SQLSTATE{" "}
          <code>40001</code> (<code>serialization_failure</code>).{cite("failure-handling")} Only transactions that update need
          retrying: read-only ones never get serialization conflicts.{cite("transaction-iso")}
        </p>
        <TryIt simHref={simHref} items={see("first-updater-wins")} />
      </WriteupSection>

      <WriteupSection id="serializable" title="Write skew and Serializable">
        <p>
          Repeatable Read is not serializable. Each transaction sees a stable view, but the combined result may match no serial
          order, and the docs say plainly that enforcing business rules at this level is not likely to work without explicit
          locks.{cite("transaction-iso")} The simulator&apos;s example is a household rule, alice + bob ≥ 0: two withdrawals each
          check the sum, see 200, and withdraw 150 from a different account. They write different rows, so no write conflict
          fires, and both commit: write skew.
        </p>
        <p>
          SERIALIZABLE works exactly like Repeatable Read, plus monitoring for conditions that would make the result inconsistent
          with every serial order. Reads take predicate locks (shown in <code>pg_locks</code> as <code>SIReadLock</code>) that
          never block anyone. A sequential scan always takes a relation-level one. SIRead locks often stay after commit, until the
          overlapping read-write transactions are done.{cite("transaction-iso")}
        </p>
        <p>
          When one transaction writes data another read without seeing the change, the reader must come first in any serial order:
          an rw-conflict. A transaction with an rw-conflict in and one out is a pivot, and once such a structure could form a cycle,
          one transaction is rolled back to break it.{cite("applevel", "predicate")} In the simulator, the first withdrawal to commit
          dooms the other, and its <code>COMMIT</code> fails:{cite("predicate")}
        </p>
        <ServerOutput>
          {`ERROR:  could not serialize access due to read/write dependencies among transactions
DETAIL:  Reason code: Canceled on identification as a pivot, during commit attempt.
HINT:  The transaction might succeed if retried.`}
        </ServerOutput>
        <Callout tone="warn" title="Data read in a failed transaction is not valid">
          At Serializable, don&apos;t trust anything a transaction read until it commits: if it is rolled back, what it read may
          have been part of an anomaly. Retry it instead.{cite("transaction-iso")}
        </Callout>
        <TryIt simHref={simHref} items={see("write-skew", "serializable")} />
      </WriteupSection>

      <WriteupSection id="locks" title="Row locks and deadlocks">
        <p>
          Row-level locks block only writers and lockers of the same row, never plain queries, and they are held until the
          transaction ends. An <code>UPDATE</code> that doesn&apos;t change key columns takes <code>FOR NO KEY UPDATE</code>;{" "}
          <code>SELECT … FOR UPDATE</code> takes <code>FOR UPDATE</code>, and the two conflict.{cite("explicit-locking")} A
          backend waiting for another transaction shows up in <code>pg_stat_activity</code> with <code>wait_event_type</code>{" "}
          <code>Lock</code> and <code>wait_event</code> <code>transactionid</code>.{cite("monitoring")}
        </p>
        <p>
          Two transactions that update the same rows in opposite orders can each wait for the other. Checking for that is
          expensive, so a backend only checks after it has waited <code>deadlock_timeout</code>, 1s by default.
          {cite("deadlock-timeout")} When it finds a cycle, the transaction is aborted with <code>deadlock detected</code>, and the
          detail lists each process and the lock it waits for, e.g. <code>Process 4243 waits for ShareLock on transaction 740</code>
          {cite("deadlock-c", "lmgr")}. Which transaction is aborted is hard to predict; the best defence is to take locks in a
          consistent order. Without a detected deadlock, a lock wait lasts indefinitely, so holding a transaction open while an
          app waits is a bad idea.{cite("explicit-locking")}
        </p>
        <TryIt simHref={simHref} items={see("deadlock")} />
      </WriteupSection>

      <WriteupSection id="errors" title="Errors and retries">
        <p>
          PostgreSQL offers no automatic retry, because it can&apos;t know whether retrying is correct. The application must re-run
          the complete transaction, including the logic that decided which SQL to send and which values to use. Retrying may take
          several attempts.{cite("failure-handling")}
        </p>
        <Compare
          head={["SQLSTATE", "Name", "Message in this simulator", "What to do"]}
          rows={[
            ["40001", "serialization_failure", "could not serialize access due to concurrent update / read/write dependencies", "Retry the whole transaction"],
            ["40P01", "deadlock_detected", "deadlock detected", "Retrying is advisable"],
            ["25P02", "in_failed_sql_transaction", "current transaction is aborted, commands ignored until end of transaction block", "ROLLBACK, then start again"],
            ["57014", "query_canceled", "canceling statement due to user request", "Here: sent by pg_cancel_backend"],
            ["57P01", "admin_shutdown", "terminating connection due to administrator command", "Here: sent by pg_terminate_backend"],
            ["23505", "unique_violation", "duplicate key value violates unique constraint", "Retry only with care"],
          ]}
        />
        <p className="text-note">
          Codes{cite("errcodes")}, messages{cite("postgres-c", "nbtinsert")}, admin functions{cite("functions-admin")}.
        </p>
        <p>
          After an error inside <code>BEGIN</code>, the transaction is aborted and every further command fails until the block
          ends. Sending <code>COMMIT</code> then is reported as <code>ROLLBACK</code>{cite("postgres-c", "utility")}, and a{" "}
          <code>COMMIT</code> outside any block only gets <code>WARNING: there is no transaction in progress</code>.{cite("xact-c")}{" "}
          A unique-key failure can be a serialization failure in disguise (two sessions picking the same new key), but it can also
          be permanent, so retry it with care.{cite("failure-handling")}
        </p>
        <TryIt simHref={simHref} items={see("first-updater-wins", "deadlock")} />
      </WriteupSection>

      <WriteupSection id="alternatives" title="Choosing a level">
        <Compare
          head={["", "Read Committed", "Repeatable Read", "Serializable"]}
          rows={[
            ["Snapshot", "New one per statement", "One per transaction", "One per transaction"],
            ["Concurrent update of your row", "Waits, then applies to the new version", "Waits, then 40001", "Waits, then 40001"],
            ["Lost update (read, then write a literal)", "Possible", "Prevented (40001)", "Prevented (40001)"],
            ["Write skew", "Possible", "Possible", "Prevented (40001)"],
            ["Extra blocking", "None", "None", "None (SIRead locks don't block)"],
            ["App must retry", "Deadlocks only", "40001 and deadlocks", "40001 and deadlocks"],
          ]}
        />
        <p className="text-note">Source: the isolation chapter{cite("transaction-iso", "applevel")}.</p>
        <ul>
          <li>
            Simple, independent updates (<code>SET balance = balance + 30</code>) are fine at <strong>Read Committed</strong>, which
            the docs describe as fast, simple and adequate for many applications.{cite("transaction-iso")}
          </li>
          <li>
            Reports and checks that must see one consistent state: <strong>Repeatable Read</strong>.
          </li>
          <li>
            Rules that span rows (sums, &quot;at least one&quot;, &quot;not more than&quot;): <strong>Serializable</strong> for every
            transaction involved, with a retry loop. The docs suggest it can simplify development, and recommend declaring
            transactions <code>READ ONLY</code> where possible and keeping them short.{cite("transaction-iso")}
          </li>
          <li>
            Or keep a lower level and lock explicitly with <code>SELECT … FOR UPDATE</code>, at the cost of blocking.
            {cite("applevel")}
          </li>
        </ul>
      </WriteupSection>

      <WriteupSection id="simplifies" title="What this simulation simplifies">
        <Callout title="Model vs reality">
          <ul>
            <li>
              Time is slowed down about a thousand times: a network hop takes 0.3 s and apps pause seconds between statements so the
              interleaving can be watched. <code>deadlock_timeout</code> keeps its 1 s default, in simulated time.
            </li>
            <li>
              Transaction IDs start at 740 (xid 739 loaded the table). The model assigns an xid at a transaction&apos;s first write
              or row lock. Command IDs (<code>cmin</code>, <code>cmax</code>) and physical locations (<code>ctid</code>) are not
              shown.
            </li>
            <li>
              Dead row versions are kept and counted; real tables get them removed by <code>VACUUM</code>.{cite("vacuum")} The
              canvas shows the newest three versions per row.
            </li>
            <li>
              Statements execute instantly once they reach the server. A waiter goes straight to waiting on the other
              transaction&apos;s ID; the real server takes a tuple lock first.
            </li>
            <li>
              SSI is modelled as rw-conflicts between transactions with the dangerous-structure checks from{" "}
              <code>predicate.c</code>. Read-only optimisations, lock granularity (tuple and page locks, promotion) and summarising
              old transactions are left out: a sum or <code>SELECT *</code> takes a relation-level lock, a single-row read a tuple
              lock.
            </li>
            <li>
              The deadlock check aborts the backend that ran it. The apps are scripted, retry at most 3 times with a fixed 0.9 s
              pause, and send <code>ROLLBACK</code> after any error inside a transaction. The household rule and the deposit
              programs are examples made up for this simulation.
            </li>
            <li>
              Modelled on PostgreSQL 18, the current major release.{cite("versioning")}
            </li>
          </ul>
        </Callout>
      </WriteupSection>
    </Prose>
  );
}
