import { AnnotatedConfig, Callout, citer, Compare, Figure, Prose, TryIt, WriteupSection } from "@/components/writeup";
import type { WriteupMeta } from "@/sims/explainers";
import { scenarios } from "../scenarios";
import { sources } from "../sources";
import { UpstreamDiagram } from "./UpstreamDiagram";

export const meta: WriteupMeta = {
  title: "How nginx load balancing methods actually choose a server",
  lede: "Round robin, random, least_conn and random two, run side by side on the same requests. Methods that count active connections route around slow and stuck servers; methods that don't keep sending them their share.",
  facts: [
    { label: "Default", value: "weighted round robin" },
    { label: "Load signal", value: "active connections" },
    { label: "Health checks", value: "passive (max_fails)" },
    { label: "On failure", value: "next server" },
  ],
  sections: [
    { id: "path", title: "The path of one request" },
    { id: "methods", title: "Four ways to pick a server" },
    { id: "uneven", title: "Uneven requests, uneven servers" },
    { id: "weights", title: "Weights" },
    { id: "failures", title: "Failures, retries and max_fails" },
    { id: "black-hole", title: "A dead server with no connections" },
    { id: "timeouts", title: "Hung servers and timeouts" },
    { id: "alternatives", title: "Choosing a method" },
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

/** Long-form write-up for /load-balancing/algorithms/how-it-works (server component). */
export function Explainer({ simHref }: { simHref: string }) {
  return (
    <Prose>
      <WriteupSection id="path" title="The path of one request">
        <p>
          In nginx, a group of backend servers is an <code>upstream</code> block, one <code>server</code> line per
          backend, and <code>proxy_pass</code> sends requests to the group.{cite("lb-guide", "upstream")} Each request
          needs one server picked from the group, and the balancing method decides which. Without a method directive,
          nginx uses weighted round robin.{cite("upstream")}
        </p>
        <Figure
          caption={
            <ol className="list-decimal space-y-1 pl-5">
              <li>A request arrives at an nginx worker process and has to be passed to the group.</li>
              <li>
                The method picks a server. Every method skips servers marked <code>down</code>, servers that reached{" "}
                <code>max_fails</code> within <code>fail_timeout</code>, and servers this request has already tried.
                {cite("rr-c", "lc-c", "random-c")}
              </li>
              <li>
                nginx counts the request as an active connection on that server until the response or a failure comes
                back. <code>least_conn</code> and <code>random two</code> compare these counts.{cite("rr-c", "lc-c")}
              </li>
            </ol>
          }
        >
          <UpstreamDiagram />
        </Figure>
        <p>
          The simulator runs four such groups next to each other. Each has its own copy of three backends, and every
          request goes to all four groups at the same moment, so the only difference between them is the method.
        </p>
        <TryIt simHref={simHref} items={see("even")} />
      </WriteupSection>

      <WriteupSection id="methods" title="Four ways to pick a server">
        <ul>
          <li>
            <strong>Round robin</strong> (the default): servers take turns, in proportion to their weights.
            {cite("lb-guide", "upstream")} nginx makes the turns smooth: on every pick it adds each server&apos;s
            weight to a running <code>current_weight</code>, chooses the server with the highest value, and subtracts
            the total weight from the winner.{cite("rr-c")} With weights 3, 1 and 1, five picks come out as a, b, a, c,
            a rather than three a&apos;s in a row.
          </li>
          <li>
            <strong>
              <code>random</code>
            </strong>
            : a server chosen at random, taking weights into account (1.15.1+).{cite("upstream")}
          </li>
          <li>
            <strong>
              <code>least_conn</code>
            </strong>
            : the server with the fewest active connections, taking weights into account. If several are tied, they
            are tried in turn by weighted round robin.{cite("upstream")} The comparison is connections divided by
            weight.{cite("lc-c")}
          </li>
          <li>
            <strong>
              <code>random two</code>
            </strong>
            : two servers chosen at random, then the one picked by a method, <code>least_conn</code> by default.
            {cite("upstream")} The two picks are different servers, and a tie goes to the second.{cite("random-c")}
          </li>
        </ul>
        <p>
          Round robin and <code>random</code> never look at what a server is doing. <code>least_conn</code> and{" "}
          <code>random two</code> look at one number: requests nginx has sent to the server that haven&apos;t finished.
          Neither knows how long a request will take.{cite("lc-c", "random-c")}
        </p>
        <TryIt simHref={simHref} items={see("even")} />
      </WriteupSection>

      <WriteupSection id="uneven" title="Uneven requests, uneven servers">
        <p>
          The nginx guide describes the case for <code>least_conn</code>: it controls the load more fairly when some
          requests take longer to complete, by not overloading a busy server and sending new requests to a less busy one.
          {cite("lb-guide")} It also notes that round robin spreads requests evenly only if they are processed in a
          uniform way and complete fast enough.{cite("lb-guide")}
        </p>
        <p>
          In the simulator, a heavy request occupies one of a server&apos;s workers for eight times as long. Round robin
          still gives that server its next turn, so a quick request can wait in the queue behind the heavy one.{" "}
          <code>least_conn</code> sees the open connection and sends the quick request elsewhere. The same happens when a
          whole server slows down: its unfinished requests pile up, and only the methods that count them send it less.
        </p>
        <Callout title="p50 and p95: read the tail, not the median">
          <p>
            The simulator reports response times as percentiles. <strong>p50</strong> is the median: half the requests
            finished faster than it. <strong>p95</strong> is the time that 95 out of every 100 requests beat; the slowest 5
            took longer. A p50 of 1.0s with a p95 of 4.0s means a typical request takes a second, but one in twenty waits
            four seconds or more.
          </p>
          <p>
            Most requests find a free server under every method, so p50 barely moves between the four groups. The
            difference shows up in p95: the requests that landed behind a heavy one or on the slow server.
          </p>
        </Callout>
        <TryIt simHref={simHref} items={see("heavy", "slow-server")} />
      </WriteupSection>

      <WriteupSection id="weights" title="Weights">
        <p>
          The <code>weight</code> parameter of a <code>server</code> line defaults to 1.{cite("upstream")} With{" "}
          <code>weight=5</code> on one of three servers, nginx distributes every 7 requests as 5, 1 and 1.
          {cite("upstream")} Weights also count in <code>least_conn</code>, <code>random</code> and{" "}
          <code>random two</code>.{cite("upstream")}
        </p>
        <p>
          Weights describe capacity you know in advance, such as a bigger machine. They don&apos;t react: if the big
          machine slows down, round robin still sends it its weighted share. <code>least_conn</code> divides
          connections by weight, so a <code>weight=3</code> server may hold three times as many before it looks as busy
          as the others.{cite("lc-c")}
        </p>
        <TryIt simHref={simHref} items={see("weights")} />
      </WriteupSection>

      <WriteupSection id="failures" title="Failures, retries and max_fails">
        <p>
          If an error occurs while talking to a server, nginx passes the request to the next server, until all the
          functioning servers have been tried.{cite("upstream")} Which failures count is set by{" "}
          <code>proxy_next_upstream</code>, by default <code>error timeout</code>: an error or a timeout while
          connecting, sending the request or reading the response header.{cite("proxy")} Non-idempotent requests (<code>POST</code>,{" "}
          <code>LOCK</code>, <code>PATCH</code>) are not passed on once they have been sent, and nothing can be retried after part of the response
          has gone to the client.{cite("proxy")}
        </p>
        <p>
          Failures also feed nginx&apos;s passive health check, set per server:{cite("upstream")}
        </p>
        <AnnotatedConfig
          parts={[
            { token: "server", label: "directive" },
            { token: "api-2", label: "address", tone: "accent" },
            { token: "max_fails=1", label: "failures that count (default 1)", tone: "warn" },
            { token: "fail_timeout=10s", label: "window and pause (default 10s)", tone: "warn" },
          ]}
        />
        <p>
          When <code>max_fails</code> failed attempts happen within <code>fail_timeout</code>, the server is considered
          unavailable for <code>fail_timeout</code>.{cite("upstream")} nginx logs{" "}
          <code>upstream server temporarily disabled</code>.{cite("rr-c")} Afterwards it probes the server with live
          client requests, and a successful one marks the server live again.{cite("lb-guide")}
        </p>
        <p>
          A crashed process on a running host doesn&apos;t time out: the host answers the connection attempt with a reset
          (RST), because nothing listens on the port.{cite("rfc9293")} nginx treats it as an error and retries elsewhere
          at once, so clients see a slightly slower response instead of an error. Only when every server is unavailable
          does nginx log <code>no live upstreams</code> and answer 502 Bad Gateway.{cite("upstream-c")}
        </p>
        <TryIt simHref={simHref} items={see("crash")} />
      </WriteupSection>

      <WriteupSection id="black-hole" title="A dead server with no connections">
        <p>
          <code>max_fails=0</code> disables the accounting of failed attempts.{cite("upstream")} A server that refuses
          every connection is then never skipped. Worse, its refusals come back immediately and each one ends that
          connection, so its active count stays near zero.{cite("rr-c")} To <code>least_conn</code>, that looks like the
          least loaded server in the group, and it gets picked first again and again.{cite("lc-c")} Every request it
          catches pays for a failed attempt before its retry.
        </p>
        <Callout tone="warn" title="Fast failure looks like spare capacity">
          <p>
            Counting connections only works if failures are counted too. Keep <code>max_fails</code> above zero on
            groups that use <code>least_conn</code> or <code>random two</code>.
          </p>
        </Callout>
        <TryIt simHref={simHref} items={see("black-hole")} />
      </WriteupSection>

      <WriteupSection id="timeouts" title="Hung servers and timeouts">
        <p>
          A server that accepts connections but never answers costs clients more than one that crashed. nginx waits up to{" "}
          <code>proxy_read_timeout</code> (default 60s) between two reads before closing the connection.{cite("proxy")}{" "}
          It then logs <code>upstream timed out</code>; the timeout counts as a failed attempt, and the request goes to
          the next server, or the client gets 504 Gateway Timeout.{cite("proxy", "upstream-c")}
        </p>
        <p>
          Until that first timeout, round robin and <code>random</code> keep sending the hung server its share, and every
          one of those requests waits the full timeout. With <code>least_conn</code>, the stuck requests count as active
          connections, so the hung server soon looks like the busiest one and stops getting new requests, before nginx
          knows anything is wrong.{cite("lc-c")}
        </p>
        <TryIt simHref={simHref} items={see("hang")} />
      </WriteupSection>

      <WriteupSection id="alternatives" title="Choosing a method">
        <Compare
          head={["", "Round robin", "random", "least_conn", "random two"]}
          rows={[
            ["Directive", "none (default)", "random;", "least_conn;", "random two;"],
            ["Looks at load", "No", "No", "Active connections ÷ weight", "Active connections of two random servers"],
            ["Weights", "Yes", "Yes", "Yes", "Yes"],
            ["Slow or stuck server", "Keeps its share", "Keeps its share", "Gets fewer new requests", "Gets fewer new requests"],
          ]}
        />
        <p className="text-note">Sources: the upstream module reference{cite("upstream")} and the balancer source.{cite("rr-c", "lc-c", "random-c")}</p>
        <ul>
          <li>
            Need the same client to reach the same server? <code>ip_hash</code> hashes the client&apos;s address, so
            requests from one client go to one server unless it is unavailable.{cite("lb-guide")}
          </li>
          <li>
            Running several worker processes? The <code>zone</code> directive keeps the group&apos;s run-time state in
            shared memory, shared between worker processes.{cite("upstream")}
          </li>
          <li>
            <code>least_time</code>, which also weighs average response time, was part of the commercial subscription
            until 1.31.0 (mainline), so it isn&apos;t in the 1.30 stable release modelled here.{cite("upstream", "download")}
          </li>
        </ul>
      </WriteupSection>

      <WriteupSection id="simplifies" title="What this simulation simplifies">
        <Callout title="Model vs reality">
          <ul>
            <li>
              Time runs in slow motion: a network hop is 0.2s and a normal request 0.6s of work. <code>fail_timeout</code>{" "}
              and <code>proxy_read_timeout</code> are scaled down from their defaults to fit a 30-second run.
            </li>
            <li>
              nginx runs as one worker process here, so every pick sees every counter. Its own time (parsing, connecting)
              is zero.
            </li>
            <li>
              The backends are a generic app server: a fixed number of workers and a first-come-first-served queue. A
              speed change applies to requests that start after it.
            </li>
            <li>When nginx gives up on a request, the model&apos;s backend drops it at once; a real server may keep working on it.</li>
            <li>
              The four copies of a server (one per group) always share the same condition, so every group faces
              identical inputs. In a real deployment, one set of servers would sit behind one method.
            </li>
            <li>
              p50 and p95 are over the last 50 normal (not heavy) requests, measured from nginx receiving a request to
              receiving its response.
            </li>
            <li>Narration shortens nginx&apos;s error log lines to their message text.</li>
          </ul>
        </Callout>
      </WriteupSection>
    </Prose>
  );
}
