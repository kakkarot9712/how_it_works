"use client";

import { Fragment, useState, type FormEvent } from "react";
import { murmur2, partitionForKey } from "@/lib/murmur2";
import { cx } from "@/lib/cx";
import { Button, Eyebrow, Help, Pill, Surface, surfaceClass, Tag } from "@/components/ui";

const TOPIC = "orders";
const START = 3;
const MAX_PARTITIONS = 6;
const PRESET = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9"];

interface Rec {
  key: string;
  partition: number;
  offset: number;
  /** Partition count when it was sent. */
  parts: number;
}

/** A key whose current partition differs from where some of its records already are. */
interface Moved {
  key: string;
  /** Partitions still holding its earlier records, with counts, in order of first use. */
  left: { partition: number; count: number }[];
  /** Where it goes now. */
  now: number;
  /** Records already sent to `now` since the move. */
  arrived: number;
}

const pname = (p: number) => `${TOPIC}-${p}`;

/**
 * Explore step widget: send keyed records to a topic and watch Kafka's own partitioner
 * (a port of murmur2, checked against Kafka's test vectors) place them. Each partition is
 * an append-only log with its own offsets. "Add a partition" lists the keys whose partition
 * changed and what they left behind; clicking a key lights up its records everywhere.
 */
export function KeyPartitioner() {
  const [n, setN] = useState(START);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [draft, setDraft] = useState("");
  const [last, setLast] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const send = (keys: string[]) => {
    setRecs((prev) => {
      const out = [...prev];
      for (const key of keys) {
        const partition = partitionForKey(key, n);
        out.push({ key, partition, offset: out.filter((r) => r.partition === partition).length, parts: n });
      }
      return out;
    });
    setLast(keys[keys.length - 1]);
  };
  const submit = () => {
    const key = draft.trim();
    if (!key) return;
    send([key]);
    setDraft("");
  };

  const keys = [...new Set(recs.map((r) => r.key))];
  const moved: Moved[] = keys.flatMap((key) => {
    const now = partitionForKey(key, n);
    const mine = recs.filter((r) => r.key === key);
    const elsewhere = [...new Set(mine.map((r) => r.partition))].filter((p) => p !== now);
    if (!elsewhere.length) return [];
    return [{ key, now, arrived: mine.filter((r) => r.partition === now).length, left: elsewhere.map((p) => ({ partition: p, count: mine.filter((r) => r.partition === p).length })) }];
  });
  const stayed = keys.filter((k) => !moved.some((m) => m.key === k));

  const addPartition = () => {
    const next = n + 1;
    setN(next);
    // Spotlight the first key the new count moves, so the change is visible at once.
    const first = keys.find((k) => recs.some((r) => r.key === k && r.partition !== partitionForKey(k, next)));
    setFocus(first ?? null);
  };

  const h = last === null ? null : murmur2(last);
  return (
    <Surface className="not-prose my-8 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-1.5"
        >
          <label htmlFor="kp-key" className="sr-only">
            Record key
          </label>
          <input
            id="kp-key"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="a key, e.g. u42"
            maxLength={24}
            autoComplete="off"
            className={surfaceClass({ level: "raised", radius: "md" }, "w-40 px-3 py-1.5 font-mono text-note text-fg placeholder:text-fg-muted")}
          />
          <Button tone="primary" onClick={submit} disabled={!draft.trim()}>
            Send
          </Button>
        </form>
        <Button onClick={() => send(PRESET)}>Send u1…u9</Button>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <Button onClick={addPartition} disabled={n >= MAX_PARTITIONS}>
          + Add a partition
        </Button>
        <Button
          tone="ghost"
          onClick={() => {
            setRecs([]);
            setN(START);
            setLast(null);
            setFocus(null);
          }}
        >
          Reset
        </Button>
      </div>

      <div className="space-y-2 px-4 py-4">
        {Array.from({ length: n }, (_, p) => {
          const log = recs.filter((r) => r.partition === p);
          return (
            <div key={p} className="flex items-center gap-3">
              <span className="w-20 shrink-0 font-mono text-note text-fg">
                {pname(p)}
                {p >= START && <span className="block text-2xs text-fg-muted">added</span>}
              </span>
              <div className={surfaceClass({ level: "raised", radius: "md" }, "flex min-h-9 flex-1 flex-wrap items-center gap-1 px-2 py-1.5")}>
                {log.length === 0 && <span className="text-xs text-fg-muted">empty</span>}
                {log.map((r, i) => {
                  const era = i > 0 && log[i - 1].parts !== r.parts;
                  const lit = focus === r.key;
                  return (
                    <Fragment key={r.offset}>
                      {era && (
                        <span className="ml-1 border-l-2 border-warn/60 pl-1.5 font-mono text-2xs text-warn">
                          {r.parts} partitions →
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setFocus(lit ? null : r.key)}
                        aria-pressed={lit}
                        className={cx("rounded transition-opacity", focus && !lit && "opacity-40")}
                      >
                        <Tag mono tone={lit ? "accent" : r.key === last && i === log.length - 1 && !focus ? "accent" : undefined}>
                          {r.key} @{r.offset}
                        </Tag>
                      </button>
                    </Fragment>
                  );
                })}
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-xs text-fg-muted">next @{log.length}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 border-t border-line px-4 py-3">
        {last !== null && h !== null ? (
          <p className="font-mono text-note text-fg">
            murmur2(&quot;{last}&quot;) = {h} → toPositive = {h & 0x7fffffff} → % {n} = <span className="text-accent">{pname(partitionForKey(last, n))}</span>
          </p>
        ) : (
          <Help>Send a few keys. The line here shows the partitioner&apos;s arithmetic for the last one. Click any record to follow its key.</Help>
        )}

        {n > START && keys.length > 0 && (
          <div className="space-y-2">
            <Eyebrow>
              With {n} partitions, {moved.length} of {keys.length} keys go somewhere new
            </Eyebrow>
            {moved.length > 0 && (
              <ul className="space-y-1">
                {moved.map((m) => {
                  const lit = focus === m.key;
                  const behind = m.left.reduce((s, l) => s + l.count, 0);
                  return (
                    <li key={m.key}>
                      <button
                        type="button"
                        onClick={() => setFocus(lit ? null : m.key)}
                        aria-pressed={lit}
                        className={cx(
                          "flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border px-3 py-1.5 text-left text-note transition-colors",
                          lit ? "border-accent/60 bg-accent/10" : "border-line hover:bg-panel-2",
                        )}
                      >
                        <span className={cx("w-12 font-mono", lit ? "text-accent" : "text-fg")}>{m.key}</span>
                        <span className="font-mono text-fg">
                          {m.left.map((l) => pname(l.partition)).join(", ")} → {pname(m.now)}
                        </span>
                        <span className="text-fg-muted">
                          {behind} old record{behind === 1 ? "" : "s"} stay{behind === 1 ? "s" : ""} behind
                          {m.arrived ? `, ${m.arrived} new in ${pname(m.now)}` : `; the next one goes to ${pname(m.now)}`}
                        </span>
                        {m.arrived > 0 && (
                          <Pill size="sm" tone="warn">
                            history split
                          </Pill>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {stayed.length > 0 && (
              <p className="text-note text-fg-muted">
                Unchanged: <span className="font-mono">{stayed.join(", ")}</span>
              </p>
            )}
            {moved.some((m) => m.arrived > 0) && (
              <Help>
                A key with a split history has older records in one partition and newer ones in another. Each partition is still read in order, but
                nothing orders one partition against the other, so the per-key ordering guarantee no longer covers that key&apos;s whole history.
              </Help>
            )}
          </div>
        )}
      </div>
    </Surface>
  );
}
