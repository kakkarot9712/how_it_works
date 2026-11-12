import { Prose } from "@/components/Prose";

/** Long-form explanation rendered under the simulation (server component). */
export function Explainer() {
  return (
    <Prose>
      <h2>How Redis Pub/Sub actually works</h2>
      <p>
        A client runs <code>SUBSCRIBE orders</code> and its connection switches into a subscribed state. Redis adds the
        connection to the subscriber list for <code>orders</code> (a dictionary from channel name to client list).{" "}
        <code>PSUBSCRIBE pay*</code> adds the connection to a separate list of glob patterns. That&apos;s all the state
        there is: subscriptions live on connections, in memory.
      </p>
      <p>
        When a client runs <code>PUBLISH orders &quot;order#42&quot;</code>, Redis walks the channel&apos;s subscriber
        list, then checks every pattern, and for each match it appends a RESP array to that client&apos;s{" "}
        <strong>output buffer</strong>: <code>[&quot;message&quot;, channel, payload]</code>, or{" "}
        <code>[&quot;pmessage&quot;, pattern, channel, payload]</code> for pattern matches. It replies to the publisher
        with the number of receivers. A client subscribed to both a channel and a matching pattern receives the message
        twice.
      </p>

      <h3>At-most-once, no storage</h3>
      <p>
        Nothing is written to a log, RDB or AOF. Subscribers send no acknowledgements. If nobody is subscribed when{" "}
        <code>PUBLISH</code> runs, the message is discarded and the reply is <code>0</code>. If a subscriber is
        restarting, it misses everything published in the meantime, and there&apos;s no offset to resume from. Each
        message is delivered at most once.
      </p>

      <h3>Push delivery and the client output buffer</h3>
      <p>
        Pub/Sub is <em>push</em>-based: Redis writes to the subscriber whether or not it&apos;s ready. Redis runs a
        single-threaded event loop and never blocks on a slow socket. When the kernel&apos;s socket buffers are full
        (TCP flow control has closed the window), the remaining bytes wait in the client output buffer, in Redis&apos;s
        own memory. A slow consumer becomes Redis&apos;s memory problem.
      </p>
      <p>That&apos;s why Redis ships with a limit for Pub/Sub clients:</p>
      <pre>
        <code>client-output-buffer-limit pubsub 32mb 8mb 60</code>
      </pre>
      <ul>
        <li>
          <strong>Hard limit (32mb):</strong> the moment the buffer exceeds it, the client is closed.
        </li>
        <li>
          <strong>Soft limit (8mb) for 60 seconds:</strong> if the buffer stays above 8mb continuously for 60 seconds, the
          client is closed. Dropping below resets the timer.
        </li>
      </ul>
      <p>
        When a client is closed, its whole output buffer is freed and those messages are lost. Redis logs{" "}
        <code>Client … scheduled to be closed ASAP for overcoming of output buffer limits.</code> A client that
        reconnects while still slow hits the limit again, and keeps doing so.
      </p>

      <h3>Without the limit</h3>
      <p>
        Setting the limit to <code>0 0 0</code> removes it. A stuck subscriber&apos;s buffer then grows without bound.
        Client output buffers count toward <code>used_memory</code>, so with <code>maxmemory</code> set, Redis may start
        evicting <em>your keys</em> to make room. Without it, the host eventually runs out of RAM and the OOM killer
        stops Redis, disconnecting every client, including the healthy ones.
      </p>

      <h3>A slow reader and a dead network look the same</h3>
      <p>
        If the network to a subscriber breaks silently, no FIN or RST arrives. Redis only sees that the TCP window stopped
        opening, which is exactly what a slow reader looks like, so the buffer grows until the limit closes the client.
        The subscriber only reads and never sends, so it may not notice for a long time: the connection is{" "}
        <em>half-open</em>. TCP keepalive (Redis defaults <code>tcp-keepalive 300</code> on its side) or an
        application-level <code>PING</code> health check is how clients detect it.
      </p>

      <h3>When to use something else</h3>
      <ul>
        <li>
          Need to survive consumer restarts, or replay history? Use <strong>Redis Streams</strong>: an append-only log
          with consumer groups, acknowledgements (<code>XACK</code>) and a pending entries list.
        </li>
        <li>
          Need durable, high-throughput, replayable messaging where slow consumers can&apos;t hurt the broker? Use a{" "}
          <strong>pull</strong>-based log like Kafka: consumers fetch at their own pace and only fall behind (lag).
        </li>
        <li>
          On Redis Cluster 7+, <code>SSUBSCRIBE</code>/<code>SPUBLISH</code> (sharded Pub/Sub) keep traffic on the shard
          that owns the channel&apos;s slot instead of broadcasting to every node.
        </li>
      </ul>

      <h3>What this simulation simplifies</h3>
      <ul>
        <li>Time is slowed down about a thousand times, and buffer limits are scaled from MB to KB to match.</li>
        <li>
          TCP is modelled as a fixed window of messages rather than bytes, segments and ACK clocking. Retransmission
          uses a fixed timeout.
        </li>
        <li>Message sizes approximate the RESP encoding. Real Redis adds some per-reply-block overhead.</li>
        <li>Redis checks the soft limit when it appends to or drains a client&apos;s buffer, which is modelled the same way here.</li>
      </ul>
    </Prose>
  );
}
