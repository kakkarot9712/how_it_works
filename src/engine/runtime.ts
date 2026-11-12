import { Heap } from "./heap";
import { SeededRng } from "./rng";
import type { LogEntry, LogLevel, SimContext, SimModel, TimedAction } from "./types";

interface QueuedEvent<E> {
  at: number;
  seq: number;
  event: E;
}

interface Snapshot<S, E> {
  time: number;
  state: S;
  queue: QueuedEvent<E>[];
  rngState: number;
  seq: number;
  actionIdx: number;
  logLength: number;
}

export interface RuntimeOptions<A> {
  seed?: number;
  /** Actions a scenario performs on its own (e.g. "subscriber goes offline at 3s"). */
  script?: { at: number; action: A }[];
  /** Simulated ms between snapshots. Smaller = faster rewind, more memory. */
  snapshotEvery?: number;
  /** Hard stop for the simulated clock, in ms. */
  maxDuration?: number;
}

/**
 * Drives a model through simulated time.
 *
 * - Events and timed actions are processed in (time, insertion) order.
 *   An action and an event at the same instant: the action goes first.
 * - Every `snapshotEvery` ms the full world is cloned, so `seek()` backwards
 *   restores the nearest snapshot and deterministically replays forward.
 * - A user action after a rewind starts a new branch: later user actions are
 *   dropped, scripted actions are kept.
 */
export class Runtime<S, E, A, P> {
  now = 0;
  /** Furthest simulated time reached on the current branch. */
  horizon = 0;
  state: S;
  log: LogEntry[] = [];
  /** Bumped whenever something observable changed. */
  version = 0;

  private queue: Heap<QueuedEvent<E>>;
  private seq = 0;
  private rng: SeededRng;
  private actions: TimedAction<A>[];
  private actionIdx = 0;
  private snapshots: Snapshot<S, E>[] = [];
  private nextSnapAt: number;
  private readonly snapshotEvery: number;
  readonly maxDuration: number;
  private readonly ctx: SimContext<E>;

  constructor(
    readonly model: SimModel<S, E, A, P>,
    readonly params: P,
    opts: RuntimeOptions<A> = {},
  ) {
    this.queue = new Heap<QueuedEvent<E>>(lessEvent);
    this.rng = new SeededRng(opts.seed ?? 1);
    this.snapshotEvery = opts.snapshotEvery ?? 250;
    this.maxDuration = opts.maxDuration ?? 10 * 60 * 1000;
    this.actions = (opts.script ?? [])
      .map((s) => ({ at: s.at, action: s.action, source: "script" as const }))
      .sort((a, b) => a.at - b.at);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.ctx = {
      get now() {
        return self.now;
      },
      rng: this.rng,
      schedule(delay: number, event: E) {
        self.queue.push({ at: self.now + Math.max(0, delay), seq: self.seq++, event });
      },
      log(level: LogLevel, text: string, extra?: { detail?: string; node?: string }) {
        self.log.push({ t: self.now, level, text, ...extra });
      },
    };

    this.state = model.init(params, this.ctx);
    this.takeSnapshot(0);
    this.nextSnapAt = this.snapshotEvery;
  }

  /** Time of the next pending event or action, or Infinity. */
  nextTime(): number {
    const e = this.queue.peek()?.at ?? Infinity;
    const a = this.actions[this.actionIdx]?.at ?? Infinity;
    return Math.min(e, a);
  }

  get finished(): boolean {
    return this.now >= this.maxDuration;
  }

  /** Simulate forward to time `t` (never past maxDuration). */
  advanceTo(t: number, maxItems = Infinity): void {
    t = Math.min(t, this.maxDuration);
    let processed = 0;
    for (;;) {
      const nt = this.nextTime();
      if (nt > t || processed >= maxItems) break;
      if (nt > this.nextSnapAt) {
        // Everything at or before the boundary is done: snapshot it.
        this.now = this.nextSnapAt;
        this.takeSnapshot(this.nextSnapAt);
        this.nextSnapAt += this.snapshotEvery;
        continue;
      }
      this.now = nt;
      this.processOne();
      processed++;
    }
    if (processed < maxItems) {
      while (this.nextSnapAt <= t) {
        this.now = this.nextSnapAt;
        this.takeSnapshot(this.nextSnapAt);
        this.nextSnapAt += this.snapshotEvery;
      }
      this.now = Math.max(this.now, t);
    }
    if (this.now > this.horizon) this.horizon = this.now;
    this.version++;
  }

  /** Process exactly the next event/action, jumping the clock to it. */
  step(): void {
    const nt = this.nextTime();
    if (!Number.isFinite(nt)) return;
    this.advanceTo(nt, 1);
  }

  /** Jump to any time. Backwards restores a snapshot and replays. */
  seek(t: number): void {
    t = Math.max(0, Math.min(t, this.maxDuration));
    if (t < this.now) {
      let i = this.snapshots.length - 1;
      while (i > 0 && this.snapshots[i].time > t) i--;
      this.restore(this.snapshots[i]);
      this.snapshots.length = i + 1;
    }
    this.advanceTo(t);
  }

  /** Apply a user action right now. Starts a new branch if we had rewound. */
  dispatch(action: A): void {
    // Drop the user's own future (it belonged to the old branch).
    const kept = this.actions.slice(this.actionIdx).filter((a) => a.source === "script");
    this.actions.length = this.actionIdx;
    this.actions.push({ at: this.now, action, source: "user" }, ...kept);
    this.horizon = this.now;
    this.advanceTo(this.now);
  }

  private processOne(): void {
    const a = this.actions[this.actionIdx];
    const e = this.queue.peek();
    if (a && (!e || a.at <= e.at)) {
      this.actionIdx++;
      this.model.act(this.state, a.action, this.ctx);
    } else if (e) {
      this.queue.pop();
      this.model.handle(this.state, e.event, this.ctx);
    }
  }

  private takeSnapshot(time: number): void {
    this.snapshots.push({
      time,
      state: structuredClone(this.state),
      queue: structuredClone(this.queue.items),
      rngState: this.rng.state,
      seq: this.seq,
      actionIdx: this.actionIdx,
      logLength: this.log.length,
    });
  }

  private restore(s: Snapshot<S, E>): void {
    this.now = s.time;
    this.state = structuredClone(s.state);
    this.queue.items = structuredClone(s.queue);
    this.rng.state = s.rngState;
    this.seq = s.seq;
    this.actionIdx = s.actionIdx;
    this.log.length = s.logLength;
    this.nextSnapAt = s.time + this.snapshotEvery;
  }
}

function lessEvent<E>(a: QueuedEvent<E>, b: QueuedEvent<E>): boolean {
  return a.at < b.at || (a.at === b.at && a.seq < b.seq);
}
