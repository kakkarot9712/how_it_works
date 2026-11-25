import { Trace, type TraceSpec } from "@/components/path";
import { citer, Prose, simplifier, WriteupSection } from "@/components/writeup";
import { pickSources } from "@/lib/sources";
import { pool } from "../sources";

export const sources = pickSources(pool, [
  "objects",
  "controllers",
  "deployment",
  "api-concepts",
  "components",
]);
const cite = citer(sources);
const simplified = simplifier(sources);

// Sections are JSX constants in reading order, so the file's citation order is the page's.
const intro = (
  <WriteupSection id="setup" title="State is objects, change is a stream">
    <p>
      Almost every object has a <code>spec</code>, the desired state you set,
      and a <code>status</code>, the current state that Kubernetes and its
      components fill in.{cite("objects")}
    </p>
    <p>
      <strong>
        A controller is the program that closes the gap between the two.
      </strong>{" "}
      It is a loop, like a thermostat: you set the temperature you want (desired
      state), the room has a temperature (current state), and the thermostat
      switches the heating on or off to bring one toward the other. A Kubernetes
      controller watches objects of at least one kind and, when they differ from
      what exists, asks the API server to create, change or delete objects.
      {cite("controllers")} The built-in ones, such as the Deployment controller
      and the Job controller, run inside <code>kube-controller-manager</code>;
      you can also run your own, as Pods or outside the cluster.
      {cite("controllers")}
    </p>
    <p>
      The controller in this trace is the <strong>Deployment controller</strong>
      . Its job: whenever a Deployment changes, for example its{" "}
      <code>replicas</code>, make its ReplicaSets match, scaling them up or
      down.{cite("deployment")} So it must hear about every change to every
      Deployment, quickly, and never miss one. This step is about how: the{" "}
      <em>watch</em>.
    </p>
    <p>
      The key is <code>resourceVersion</code>. Every object has one,
      representing its version in the storage layer, and a list response carries
      one for the whole collection.{cite("api-concepts")} A client lists, then
      watches from that version: the API server sends every change after it.
      {cite("api-concepts")} Below, the Deployment controller does that, two
      clients write the same Deployment, and the controller&apos;s connection
      drops.
    </p>
  </WriteupSection>
);

export const trace: TraceSpec = {
  actors: [
    { id: "ctrl", label: "Deployment ctrl", sub: "in controller-mgr" },
    { id: "api", label: "kube-apiserver", sub: "watch cache" },
    { id: "etcd", label: "etcd" },
    { id: "a", label: "kubectl", sub: "client A" },
    { id: "b", label: "a script", sub: "client B" },
  ],
  state: {
    fields: [
      {
        id: "rv",
        label: "Newest resourceVersion it has for Deployments",
        short: "rv",
      },
      {
        id: "rep",
        label: "spec.replicas of Deployment web, as it knows it",
        short: "replicas",
      },
      { id: "watch", label: "Its watch stream", short: "watch" },
    ],
    initial: {
      ctrl: { rv: "—", rep: "—", watch: "none" },
      api: { rv: "10245", rep: "1" },
      etcd: { rv: "10245", rep: "1" },
      b: { rv: "10245", rep: "1" },
    },
  },
  hops: [
    {
      from: "ctrl",
      to: "api",
      label: "LIST deployments",
      title: "The Deployment controller starts by listing every Deployment.",
      body: (
        <>
          A client first sends a list or a get, then a follow-up watch.
          {cite("api-concepts")} Client libraries wrap this list-then-watch
          logic; in the Go client it is the Reflector.{cite("api-concepts")}
        </>
      ),
    },
    {
      from: "api",
      to: "ctrl",
      label: "list, resourceVersion=10245",
      simplified: simplified(
        ["api-concepts"],
        <>
          One Deployment. A real list returns every object of the type, and the
          watch then carries changes to all of them.
        </>,
      ),
      reply: true,
      title: "The list carries one resourceVersion for the whole collection.",
      set: { ctrl: { rv: "10245", rep: "1" } },
      body: (
        <>
          The response contains a <code>resourceVersion</code> for the
          collection, and that is where the watch will start.
          {cite("api-concepts")} The numbers here are the ones in the Kubernetes
          docs&apos; own example. Within one resource type they order as
          increasing integers, and clients must pass them back unmodified.
          {cite("api-concepts")}
        </>
      ),
    },
    {
      from: "ctrl",
      to: "api",
      label: "WATCH from 10245",
      title: "It opens a watch from that version.",
      set: { ctrl: { watch: "open" } },
      body: (
        <>
          A <code>GET</code> with{" "}
          <code>?watch=1&amp;resourceVersion=10245</code>. The API server
          answers with a stream of changes that happened after that version, so
          the controller gets the current state and then every change, without
          missing any.{cite("api-concepts")}
        </>
      ),
    },
    {
      from: "a",
      to: "api",
      label: "PATCH replicas: 3",
      title: "kubectl scales the Deployment with a patch.",
      body: (
        <>
          A patch is an instruction to change part of an object, typically used
          when the change doesn&apos;t depend on the existing data.
          {cite("api-concepts")} It doesn&apos;t name a{" "}
          <code>resourceVersion</code>, so it applies to whatever version is
          current.
        </>
      ),
    },
    {
      from: "api",
      to: "etcd",
      label: "write",
      title: "The new version is stored, with a new resourceVersion.",
      set: { etcd: { rv: "10596", rep: "3" } },
      body: (
        <>
          <code>etcd</code> holds all API server data.{cite("components")} The
          object&apos;s <code>resourceVersion</code> represents its version as
          stored there, so the write gives it a new one.{cite("api-concepts")}
        </>
      ),
    },
    {
      from: "etcd",
      to: "api",
      label: "change @10596",
      simplified: simplified(
        ["api-concepts"],
        <>How the watch cache keeps up with etcd is drawn as this one reply.</>,
      ),
      reply: true,
      title: "The API server's watch cache follows etcd.",
      set: { api: { rv: "10596", rep: "3" } },
      body: (
        <>
          The watch cache is an in-memory store inside the API server that
          caches and mirrors the data persisted in etcd.{cite("api-concepts")}
        </>
      ),
    },
    {
      from: "api",
      to: "ctrl",
      label: "MODIFIED @10596",
      reply: true,
      title: "The controller's open watch delivers the change.",
      set: { ctrl: { rv: "10596", rep: "3" } },
      body: (
        <>
          Each watch event has a type and the object: here <code>MODIFIED</code>
          , with <code>resourceVersion</code> 10596 in its metadata.
          {cite("api-concepts")} The controller never asked again; the change
          came down the stream it already had open. Seeing <code>replicas</code>{" "}
          go from 1 to 3, it would now scale the Deployment&apos;s ReplicaSet to
          3; that part is the reconcile loop, left out here.{cite("deployment")}
        </>
      ),
    },
    {
      from: "b",
      to: "api",
      label: "PUT replicas: 2, rv=10245",
      title:
        "A script writes the whole object, based on the copy it read earlier.",
      body: (
        <>
          For a <code>PUT</code>, the client must send the{" "}
          <code>resourceVersion</code> of the object it is updating, so the API
          server can detect lost updates.{cite("api-concepts")} The script read
          the Deployment at 10245 and doesn&apos;t know about kubectl&apos;s
          change.
        </>
      ),
    },
    {
      from: "api",
      to: "b",
      label: "409 Conflict",
      reply: true,
      title: "Rejected: its copy is stale.",
      body: (
        <>
          The resource changed since 10245, so the API server returns{" "}
          <code>409 Conflict</code>.{cite("api-concepts")} Without this check
          the script would have silently undone the scale to 3. This is
          optimistic concurrency: no locks are taken, a write just names the
          version it was based on, and the client reads again and retries on a
          conflict.{cite("api-concepts")}
        </>
      ),
    },
    {
      from: "ctrl",
      to: "ctrl",
      label: "connection lost",
      simplified: simplified(
        ["api-concepts"],
        <>
          The jump to 12746 stands for changes made while the controller was
          away; the numbers are only an example.
        </>,
      ),
      title:
        "The controller's watch connection drops, and stays down for a while.",
      set: { ctrl: { watch: "closed" } },
      body: (
        <>
          A disconnected client can start a new watch from the last{" "}
          <code>resourceVersion</code> it got.{cite("api-concepts")} Meanwhile
          the Deployment keeps changing; say it is now at 12746.
        </>
      ),
    },
    {
      from: "ctrl",
      to: "api",
      label: "WATCH from 10596",
      title: "It tries to resume where it left off.",
      body: (
        <>
          The server keeps the history of changes only for a limited time: with
          etcd 3, the last 5 minutes by default.{cite("api-concepts")} This
          controller was away longer than that.
        </>
      ),
    },
    {
      from: "api",
      to: "ctrl",
      label: "410 Gone",
      reply: true,
      title: "The history it needs is gone.",
      body: (
        <>
          When the requested version is no longer available the watch fails with{" "}
          <code>410 Gone</code>, and clients must handle it.
          {cite("api-concepts")} The controller can&apos;t know what it missed,
          so it has to start over.
        </>
      ),
    },
    {
      from: "ctrl",
      to: "api",
      label: "LIST deployments",
      title: "It clears its cache and lists again.",
      set: { ctrl: { rv: "12746" } },
      body: (
        <>
          The documented recovery: clear the local cache, do a new get or list,
          and start the watch from the <code>resourceVersion</code> it returns.
          {cite("api-concepts")} A list costs far more than a watch event, which
          is why the next section&apos;s bookmarks exist.
        </>
      ),
    },
    {
      from: "ctrl",
      to: "api",
      label: "WATCH from 12746",
      title: "And watches again from the new version.",
      set: { ctrl: { watch: "open" } },
      body: (
        <>
          Back to the normal state: a current copy and an open stream of every
          change after it.{cite("api-concepts")}
        </>
      ),
    },
  ],
};

const after = (
  <>
    <WriteupSection id="takeaways" title="What to take away">
      <ul>
        <li>
          <strong>
            List, then watch from the list&apos;s resourceVersion.
          </strong>{" "}
          That pair gives a client the current state and every later change,
          with nothing missed.{cite("api-concepts")}
        </li>
        <li>
          <strong>
            <code>resourceVersion</code> is also a lock.
          </strong>{" "}
          A write that names a stale version gets <code>409 Conflict</code>{" "}
          instead of overwriting someone else&apos;s change.
          {cite("api-concepts")}
        </li>
        <li>
          <strong>History is short.</strong> A watcher away for longer than the
          retained history gets <code>410 Gone</code> and must list again.
          {cite("api-concepts")}
        </li>
      </ul>
    </WriteupSection>

    <WriteupSection id="what-if" title="What if…">
      <p>
        <strong>
          …the objects a controller watches don&apos;t change for a long time?
        </strong>{" "}
        Then its newest <code>resourceVersion</code> goes stale, even though it
        has missed nothing. Say you run a controller of your own that watches
        only the Deployments in one namespace, and the last event it got was at
        10596. Deployments elsewhere keep changing, so the server&apos;s
        versions move on to 12746 and beyond, but none of those events match
        this watch, so none reach it. Ten minutes later its connection drops. It
        can only resume from the last version it knows, 10596, which is older
        than the 5 minutes of history the server keeps, so it gets{" "}
        <code>410 Gone</code> and has to list everything again.
        {cite("api-concepts")}
      </p>
      <p>
        <code>BOOKMARK</code> events prevent that. A client asks for them by
        adding <code>allowWatchBookmarks=true</code> to its watch. Now and then
        the server sends an event that carries no object, only a{" "}
        <code>resourceVersion</code>, and means &ldquo;you have been sent every
        change up to 12746&rdquo;. The client saves 12746 as its newest version,
        so after a disconnect it resumes from a recent version that is still in
        the history, and gets no <code>410 Gone</code>. The server decides when
        to send bookmarks, so clients can&apos;t rely on any interval.
        {cite("api-concepts")}
      </p>
      <p>
        <strong>
          …two controllers, or a controller and a person, update the same
          object?
        </strong>{" "}
        The one whose <code>resourceVersion</code> is stale gets{" "}
        <code>409 Conflict</code>. Clients that need to detect lost updates make
        their writes conditional on the version they read, with <code>PUT</code>{" "}
        or <code>PATCH</code>, and retry on a conflict.{cite("api-concepts")}
      </p>
      <p>
        <strong>…a client compares two resourceVersions?</strong> Within one
        resource type, versions served by kube-apiserver order as increasing
        integers, so a client can tell which of two Deployments&apos; versions
        is newer. A Pod&apos;s and a Deployment&apos;s cannot be compared.
        {cite("api-concepts")}
      </p>
      <p>
        <strong>…does every read go to etcd?</strong> No. Many reads are served
        from the API server&apos;s watch cache, which mirrors etcd and reduces
        its load.{cite("api-concepts")}
      </p>
    </WriteupSection>
  </>
);

/** Trace: list, watch, two conflicting writers, and a watch that falls out of the history window. */
export function Body() {
  return (
    <Prose>
      {intro}
      <Trace
        spec={trace}
        title="Deployment web · one controller, two writers"
      />
      {after}
    </Prose>
  );
}
