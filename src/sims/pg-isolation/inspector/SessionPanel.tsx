"use client";

import { InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Stat, StatGrid, Toggle } from "@/components/ui";
import { LEVELS, PROGRAM_MENU, PROGRAMS, snapText, type Action, type SessionId, type State, type Stmt } from "../model";
import { sessionPill, sessionStatus } from "../theme";

/** Statements the user can send by hand, in the order a transaction usually needs them. */
const BY_HAND: { label: string; stmt: Stmt }[] = [
  { label: "SELECT *", stmt: { op: "select-all" } },
  { label: "SELECT sum(balance)", stmt: { op: "sum" } },
  { label: "SELECT alice FOR UPDATE", stmt: { op: "select", row: "alice", forUpdate: true } },
  { label: "UPDATE alice + 10", stmt: { op: "update", row: "alice", delta: 10, intent: 10 } },
  { label: "UPDATE bob - 10", stmt: { op: "update", row: "bob", delta: -10, intent: -10 } },
  { label: "INSERT carol", stmt: { op: "insert", row: "carol", balance: 50 } },
];

/** A client session: run a scripted transaction, type statements by hand, or make the app hang. */
export function SessionPanel({ s, id, dispatch }: { s: State; id: SessionId; dispatch: (a: Action) => void }) {
  const sess = s.sessions[id];
  const st = sessionStatus(sess);
  const free = sess.connected && !sess.busy && !sess.tx && !sess.mustRollback && sess.status !== "running";
  const canSend = sess.connected && !sess.busy;
  const tx = sess.tx;
  return (
    <div>
      <InspectorHeader kind="client session" title={sess.label} status={<Pill tone={st.tone}>{sessionPill(sess)}</Pill>} />
      <Section title="Run a transaction">
        <div className="grid grid-cols-1 gap-1.5">
          {PROGRAM_MENU.map((p) => (
            <Button key={p} disabled={!free} onClick={() => dispatch({ type: "run", s: id, program: p })}>
              {PROGRAMS[p].title}
            </Button>
          ))}
        </div>
        <Help>
          Each starts with BEGIN ISOLATION LEVEL {LEVELS[s.settings.isolation]} (change it under Blocks &amp; settings). Start one here
          while the other session is mid-transaction to make them overlap.
        </Help>
      </Section>
      <Section title="Type it yourself">
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((_, lvl) => (
            <Button key={lvl} disabled={!canSend || !!tx} onClick={() => dispatch({ type: "exec", s: id, stmt: { op: "begin", level: lvl } })}>
              BEGIN {LEVELS[lvl]}
            </Button>
          ))}
          {BY_HAND.map((b) => (
            <Button key={b.label} disabled={!canSend} onClick={() => dispatch({ type: "exec", s: id, stmt: b.stmt })}>
              {b.label}
            </Button>
          ))}
          <Button tone="primary" disabled={!canSend || !tx} onClick={() => dispatch({ type: "exec", s: id, stmt: { op: "commit" } })}>
            COMMIT
          </Button>
          <Button disabled={!canSend || !tx} onClick={() => dispatch({ type: "exec", s: id, stmt: { op: "rollback" } })}>
            ROLLBACK
          </Button>
        </div>
        <Help>Outside BEGIN … COMMIT, each statement runs in a transaction of its own and commits at once.</Help>
      </Section>
      <Section title="Break it">
        <Toggle
          tone="danger"
          label="App stuck"
          help="The app stops sending (a hung call, a debugger). An open transaction keeps its row locks, so others wait on it indefinitely."
          checked={sess.stalled}
          onChange={(on) => dispatch({ type: "set-stalled", s: id, on })}
        />
      </Section>
      <Section title="Stats">
        <StatGrid>
          <Stat label="xid" value={tx ? (tx.xid ?? "none yet") : "—"} />
          <Stat label="snapshot" value={tx ? snapText(tx.snapshot) : "—"} />
          <Stat label="commits" value={sess.commits} />
          <Stat label="aborts" value={sess.aborts} tone={sess.aborts ? "warn" : undefined} />
          <Stat label="retries" value={sess.retries} tone={sess.retries ? "warn" : undefined} />
          <Stat label="last error" value={sess.lastError ? sess.lastError.code : "—"} tone={sess.lastError ? "err" : undefined} />
        </StatGrid>
        <Help>
          A transaction gets an xid only when it first writes or locks a row. Its snapshot is xmin:xmax:xip_list: xids below xmin are
          finished, xids from xmax on are invisible, and xip_list are the ones still in progress.
        </Help>
      </Section>
    </div>
  );
}
