import { AnnotatedConfig, Callout, citer, Compare, Figure, Prose, TryIt, WriteupSection } from "@/components/writeup";
import type { WriteupMeta } from "@/sims/explainers";
import { PathDiagram } from "./PathDiagram";
import { scenarios } from "../scenarios";
import { sources } from "../sources";

export const meta: WriteupMeta = {
  title: "How Redis Pub/Sub actually works",
  lede: "Fire-and-forget fan-out with no storage. Every message is pushed into each subscriber's output buffer inside Redis, which is why one slow consumer can become the server's memory problem.",
  facts: [
    { label: "Delivery", value: "at-most-once" },
    { label: "Storage", value: "none" },
    { label: "Model", value: "push" },
    { label: "Safety valve", value: "output buffer limit" },
  ],
  sections: [
    { id: "path", title: "The path of one message" },
    { id: "at-most-once", title: "At-most-once, no storage" },
    { id: "output-buffer", title: "Push delivery and the output buffer" },
    { id: "no-limit", title: "Without the limit" },
    { id: "half-open", title: "Slow reader vs dead network" },
    { id: "alternatives", title: "When to use something else" },
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

/** Long-form write-up for /redis/pub-sub/how-it-works (server component). */
export function Explainer({ simHref }: { simHref: string }) {
  return (
    <Prose>
      <WriteupSection id="path" title="The path of one message">
        <p>
          A client runs <code>SUBSCRIBE orders</code> and its connection switches into a subscribed state.{cite("pubsub")} Redis adds the
          connection to the subscriber list for <code>orders</code> (a dictionary from channel name to client list).{" "}
          <code>PSUBSCRIBE pay*</code> adds the connection to a separate list of glob patterns. That&apos;s all the state
          there is: subscriptions live on connections, in memory.{cite("pubsub-c")}
        </p>
        <Figure
          caption={
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                <code className="font-mono text-fg">PUBLISH orders &quot;order#42&quot;</code> arrives on the publisher&apos;s
                connection.
              </li>
              <li>
                Redis looks up the channel&apos;s subscriber list, then checks every pattern.{cite("pubsub-c")}
              </li>
              <li>
                For each match it appends the message to that client&apos;s output buffer and replies to the publisher with
                the number of receivers.{cite("pubsub-c", "clients")}
              </li>
              <li>
                Redis writes each buffer to its non-blocking socket as far as the kernel accepts. What doesn&apos;t fit
                stays in the output buffer, in Redis&apos;s memory.{cite("clients")}
              </li>
            </ol>
          }
        >
          <PathDiagram />
        </Figure>
        <p>
          Each delivery is a RESP array: <code>[&quot;message&quot;, channel, payload]</code>, or{" "}
          <code>[&quot;pmessage&quot;, pattern, channel, payload]</code> for pattern matches. A client subscribed to both a
          channel and a matching pattern receives the message twice.{cite("pubsub")}
        </p>
        <TryIt simHref={simHref} items={see("fan-out")} />
      </WriteupSection>

      <WriteupSection id="at-most-once" title="At-most-once, no storage">
        <p>
          Pub/Sub has no relation to the key space, so messages never reach RDB snapshots, and <code>PUBLISH</code> is
          propagated to replicas but not written to the AOF.{cite("pubsub", "pubsub-c")} Subscribers send no
          acknowledgements. If nobody is subscribed when <code>PUBLISH</code> runs, the message is discarded and the reply
          is <code>0</code>. If a subscriber is restarting, it misses everything published in the meantime, and there&apos;s
          no offset to resume from. Each message is delivered at most once.{cite("pubsub")}
        </p>
        <p>
          The subscriptions aren&apos;t persisted either. When Redis restarts, every connection is gone along with its
          subscriptions. Until each client reconnects and runs <code>SUBSCRIBE</code> again, <code>PUBLISH</code> reaches
          nobody.{cite("pubsub-c")}
        </p>
        <TryIt simHref={simHref} items={see("void", "offline", "restart")} />
      </WriteupSection>

      <WriteupSection id="output-buffer" title="Push delivery and the output buffer">
        <p>
          Pub/Sub is <em>push</em>-based: Redis writes to the subscriber whether or not it&apos;s ready.{cite("resp")} Redis
          uses non-blocking sockets, so it never waits for a slow client. When the kernel&apos;s socket buffers are full
          (TCP flow control has closed the window), the remaining bytes wait in the client output buffer, in Redis&apos;s
          own memory.{cite("clients", "rfc9293")} A slow consumer becomes Redis&apos;s memory problem.
        </p>
        <p>That&apos;s why Redis ships with a limit for Pub/Sub clients. The default:{cite("clients", "redis-conf")}</p>
        <AnnotatedConfig
          parts={[
            { token: "client-output-buffer-limit", label: "directive" },
            { token: "pubsub", label: "client class", tone: "accent" },
            { token: "32mb", label: "hard limit", tone: "err" },
            { token: "8mb", label: "soft limit", tone: "warn" },
            { token: "60", label: "soft seconds", tone: "warn" },
          ]}
        />
        <ul>
          <li>
            <strong>Hard limit:</strong> the moment the buffer exceeds 32mb, the client is closed.
          </li>
          <li>
            <strong>Soft limit:</strong> if the buffer stays above 8mb continuously for 60 seconds, the client is closed.
            Dropping below resets the timer.{cite("redis-conf")}
          </li>
        </ul>
        <p>
          When a client is closed, the messages still in its output buffer are lost.{cite("pubsub")} Redis logs{" "}
          <code>Client … scheduled to be closed ASAP for overcoming of output buffer limits.</code>
          {cite("networking-c")} A client that reconnects while still slow hits the limit again.
        </p>
        <TryIt simHref={simHref} items={see("hard-limit", "soft-limit")} />
      </WriteupSection>

      <WriteupSection id="no-limit" title="Without the limit">
        <p>
          Setting the limit to <code>0 0 0</code> removes it.{cite("redis-conf")} A stuck subscriber&apos;s buffer then grows
          without bound.
        </p>
        <Callout tone="warn" title="One consumer, everyone's outage">
          <p>
            Client buffers are Redis memory, and enough of them lead to data eviction or out-of-memory errors.
            {cite("clients")} Without swap, the Linux OOM killer can kill the Redis process{cite("admin")}, logging{" "}
            <code>Out of memory: Killed process …</code>{cite("oom-kill-c")}, and every client is disconnected, including
            the healthy ones.
          </p>
        </Callout>
        <TryIt simHref={simHref} items={see("oom")} />
      </WriteupSection>

      <WriteupSection id="half-open" title="A slow reader and a dead network look the same">
        <p>
          If the network to a subscriber breaks silently, no FIN or RST arrives. Redis only sees that the TCP window
          stopped opening, which is exactly what a slow reader looks like, so the buffer grows until the limit closes the
          client.{cite("rfc9293")}
        </p>
        <p>
          The subscriber only reads and never sends, so it may not notice for a long time: the connection is{" "}
          <em>half-open</em>. TCP keepalive (Redis defaults to <code>tcp-keepalive 300</code> on its side) or an
          application-level <code>PING</code> health check is how clients detect it.{cite("rfc9293", "clients", "pubsub")}
        </p>
        <TryIt simHref={simHref} items={see("partition")} />
      </WriteupSection>

      <WriteupSection id="alternatives" title="When to use something else">
        <p>
          Pub/Sub is the right tool when losing a message is acceptable; for stronger guarantees the Redis docs point to
          Streams.{cite("pubsub")} The difference is whether the broker keeps the data and who sets the pace.
        </p>
        <Compare
          head={["", "Redis Pub/Sub", "Redis Streams", "Kafka"]}
          rows={[
            ["Stores messages", "No", "Yes, as a key (persisted if RDB/AOF is on)", "Yes, a replicated log on disk"],
            ["Delivery", "Push", "Pull: XREAD / XREADGROUP, can BLOCK", "Pull: consumers fetch"],
            ["Guarantee", "At-most-once", "At-least-once with consumer groups and XACK", "At-least-once by default"],
            ["Consumer offline", "Misses everything", "Resumes from its group's last ID", "Resumes from its committed offset"],
            [
              "Slow consumer",
              "Grows its output buffer in Redis until closed",
              "Entries wait in the stream (until trimmed)",
              "Lag grows (until retention deletes data)",
            ],
          ]}
        />
        <p className="text-note">
          Sources: Pub/Sub{cite("pubsub")}, Streams{cite("streams-intro")}, Kafka{cite("kafka-design", "kafka-consumer", "kafka-intro")}.
        </p>
        <ul>
          <li>
            Need to survive consumer restarts, or replay history? Use <strong>Redis Streams</strong>: an append-only log
            with consumer groups, acknowledgements (<code>XACK</code>) and a pending entries list.{cite("streams-intro")}
          </li>
          <li>
            Need durable, replayable messaging where each consumer sets its own pace? Use a <strong>pull</strong>-based log
            like Kafka: consumers fetch what they can handle and fall behind (lag) instead of filling a broker buffer.
            {cite("kafka-design")}
          </li>
          <li>
            On Redis Cluster 7+, <code>SSUBSCRIBE</code>/<code>SPUBLISH</code> (sharded Pub/Sub) keep traffic on the shard
            that owns the channel&apos;s slot instead of broadcasting to every node.{cite("pubsub")}
          </li>
        </ul>
      </WriteupSection>

      <WriteupSection id="simplifies" title="What this simulation simplifies">
        <Callout title="Model vs reality">
          <ul>
            <li>Time is slowed down about a thousand times, and buffer limits are scaled from MB to KB to match.</li>
            <li>
              TCP is modelled as a fixed window of messages rather than bytes, segments and ACK clocking. Retransmission
              uses a fixed timeout.
            </li>
            <li>Message sizes approximate the RESP encoding.</li>
            <li>The model checks the soft limit whenever a client&apos;s buffer grows or drains.</li>
            <li>The kernel&apos;s OOM log line is shortened: the real one continues with the process&apos;s memory figures.</li>
          </ul>
        </Callout>
      </WriteupSection>
    </Prose>
  );
}
