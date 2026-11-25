import { Trace, type TraceSpec } from "@/components/path";
import { citer, Prose, simplifier, WriteupSection } from "@/components/writeup";
import { pickSources } from "@/lib/sources";
import { pool } from "../sources";

export const sources = pickSources(pool, [
  "pod-api",
  "kubelet-config-src",
  "pod-lifecycle",
  "cri",
  "cri-proto",
  "images",
  "pods",
]);
const cite = citer(sources);
const simplified = simplifier(sources);

const intro = (
  <WriteupSection id="setup" title="From a bound Pod to a running container">
    <p>
      Once a Pod has a node, that node&apos;s kubelet is responsible for its
      lifecycle,{cite("pod-api")} and it learns about the Pod through its own
      watch.{cite("kubelet-config-src")} While the Pod runs, the kubelet manages
      its containers, translates the Pod spec for the container runtime, and
      runs the probes that track the application&apos;s health.
      {cite("pod-lifecycle")}
    </p>
    <p>
      This trace follows Pod <code>web-1</code> on <code>node-1</code>: started,
      made ready, then crashing twice and failing a liveness probe. Notice the
      difference between the Pod&apos;s <em>phase</em> and what its container is
      doing.
    </p>
  </WriteupSection>
);

export const trace: TraceSpec = {
  actors: [
    { id: "api", label: "kube-apiserver", sub: "Pod web-1" },
    { id: "kubelet", label: "kubelet", sub: "node-1" },
    { id: "rt", label: "runtime", sub: "CRI server" },
    { id: "app", label: "web", sub: "the container" },
  ],
  state: {
    fields: [
      { id: "phase", label: "Pod status.phase", short: "phase" },
      { id: "ready", label: "Pod condition Ready", short: "Ready" },
      {
        id: "state",
        label: "Container state, as the kubelet reports it",
        short: "container",
      },
      { id: "restarts", label: "Container restart count", short: "restarts" },
      { id: "sandbox", label: "Pod sandbox", short: "sandbox" },
    ],
    initial: {
      api: { phase: "Pending", ready: "False" },
      kubelet: { state: "—", restarts: "0" },
      rt: { sandbox: "none" },
    },
  },
  hops: [
    {
      from: "api",
      to: "kubelet",
      label: "watch: Pod web-1",
      reply: true,
      title: "The kubelet sees a Pod bound to its node.",
      body: (
        <>
          Its watch selects Pods whose <code>spec.nodeName</code> is this node.
          {cite("kubelet-config-src")} The Pod is <code>Pending</code>:
          accepted, with containers not yet set up.{cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "kubelet",
      to: "rt",
      label: "RunPodSandbox",
      title: "First the Pod's sandbox, before any container.",
      set: { rt: { sandbox: "ready" } },
      body: (
        <>
          The kubelet is a gRPC client of the runtime over CRI.{cite("cri")}{" "}
          <code>RunPodSandbox</code> creates and starts a pod-level sandbox, and
          the runtime must leave it ready.{cite("cri-proto")} The kubelet then
          sets the condition <code>PodReadyToStartContainers</code>: sandbox
          created and networking configured.{cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "kubelet",
      to: "rt",
      label: "PullImage web:1.4",
      title: "It asks the runtime for the image. The container is Waiting.",
      set: { kubelet: { state: "Waiting" } },
      body: (
        <>
          With no <code>imagePullPolicy</code> set and a tag other than{" "}
          <code>latest</code>, the policy defaults to <code>IfNotPresent</code>:
          the image is pulled only if it isn&apos;t already on the node.
          {cite("images")} Until it starts, the container is{" "}
          <code>Waiting</code>, for example while its image is pulled.
          {cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "kubelet",
      to: "rt",
      label: "CreateContainer, StartContainer",
      simplified: simplified(
        ["pods"],
        <>One container, with no init containers or sidecars.</>,
      ),
      title: "The container is created in the sandbox and started.",
      set: { kubelet: { state: "Running" } },
      body: (
        <>
          <code>CreateContainer</code> creates a container in the sandbox;{" "}
          <code>StartContainer</code> starts it.{cite("cri-proto")} The
          container is <code>Running</code>: executing without issues.
          {cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "kubelet",
      to: "api",
      label: "PATCH status: Running",
      title: "The Pod is Running, but not Ready.",
      set: { api: { phase: "Running" } },
      body: (
        <>
          <code>Running</code> means bound to a node with all containers created
          and at least one running.{cite("pod-lifecycle")} Ready is a separate
          condition, and it waits for the readiness probe.
          {cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "kubelet",
      to: "app",
      label: "readiness: httpGet /ready → 200",
      title: "The kubelet probes the container, and it answers.",
      body: (
        <>
          A readiness probe decides when a container is ready to accept traffic,
          and keeps running for the container&apos;s whole life.
          {cite("pod-lifecycle")} The kubelet runs the probes itself, here with
          the <code>httpGet</code> mechanism.{cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "kubelet",
      to: "api",
      label: "PATCH status: Ready=True",
      title: "Now the Pod is Ready.",
      set: { api: { ready: "True" } },
      body: (
        <>
          <code>Ready</code> means the Pod can serve requests and should be
          added to the load-balancing pools of matching Services.
          {cite("pod-lifecycle")} The networking step picks this up from here.
        </>
      ),
    },
    {
      from: "app",
      to: "app",
      label: "exit 1",
      simplified: simplified(
        ["pod-lifecycle"],
        <>
          The kubelet&apos;s status updates from here on are folded into the
          hops that cause them.
        </>,
      ),
      title: "The application crashes.",
      set: { kubelet: { state: "Terminated" }, api: { ready: "False" } },
      body: (
        <>
          A <code>Terminated</code> container started and then either finished
          or failed; the kubelet records the reason and exit code.
          {cite("pod-lifecycle")} With a container down,{" "}
          <code>ContainersReady</code> (all containers ready) no longer holds,
          so the Pod is not <code>Ready</code> either.{cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "kubelet",
      to: "rt",
      label: "StartContainer (at once)",
      title: "The first restart is immediate.",
      set: { kubelet: { state: "Running", restarts: "1" } },
      body: (
        <>
          <code>restartPolicy</code> defaults to <code>Always</code>: restart
          after any termination. After the first crash Kubernetes restarts the
          container immediately.{cite("pod-lifecycle")} It is the same Pod on
          the same node; only the container is replaced.{cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "app",
      to: "app",
      label: "exit 1 again",
      title: "It crashes again. Now the kubelet waits before restarting.",
      set: { kubelet: { state: "Waiting" } },
      body: (
        <>
          Repeated crashes get an exponential back-off: 10 s, 20 s, 40 s and so
          on, capped at 300 seconds. While a back-off is in effect, kubectl
          shows <code>CrashLoopBackOff</code> in its <code>STATUS</code> column.
          {cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "api",
      to: "api",
      label: "phase still Running",
      title: "CrashLoopBackOff is not a phase.",
      body: (
        <>
          The phase stays <code>Running</code>, which covers a container that is
          starting or restarting. <code>CrashLoopBackOff</code> is a display
          field of kubectl, not part of the Pod&apos;s phase.
          {cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "kubelet",
      to: "rt",
      label: "StartContainer (after 10 s)",
      simplified: simplified(
        ["pod-lifecycle"],
        <>
          Only the first two back-off steps are shown; the delays go on doubling
          up to 5 minutes.
        </>,
      ),
      title: "After the back-off, the next attempt.",
      set: { kubelet: { state: "Running", restarts: "2" } },
      body: (
        <>
          The Pod becomes <code>Ready</code> again only once its readiness probe
          passes. If the container now stays up for 10 minutes, the kubelet
          resets the back-off timer for this container.{cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "kubelet",
      to: "app",
      label: "liveness: httpGet /healthz ✕",
      simplified: simplified(
        ["pod-lifecycle"],
        <>
          Drawn as one hop. The kubelet restarts the container only after the
          probe has failed more times than its configured tolerance.
        </>,
      ),
      title: "Running but stuck: the liveness probe fails.",
      set: { kubelet: { restarts: "3" } },
      body: (
        <>
          A liveness probe catches a container that runs but can&apos;t make
          progress, such as a deadlock. When it fails more times than the
          configured tolerance, the kubelet restarts the container.
          {cite("pod-lifecycle")} Without a liveness probe, a hung process would
          stay &ldquo;Running&rdquo; forever.
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
            The kubelet drives the runtime, not the other way round.
          </strong>{" "}
          It is the CRI client: sandbox first, then image, then containers.
          {cite("cri", "cri-proto")}
        </li>
        <li>
          <strong>
            Phase, condition and container state are three different things.
          </strong>{" "}
          A Pod can be <code>Running</code>, not <code>Ready</code>, and in{" "}
          <code>CrashLoopBackOff</code> all at once.{cite("pod-lifecycle")}
        </li>
        <li>
          <strong>Restarts stay on the node.</strong> The kubelet restarts
          containers inside the same Pod; moving work elsewhere is a
          controller&apos;s job, with a new Pod.{cite("pod-lifecycle")}
        </li>
      </ul>
    </WriteupSection>

    <WriteupSection id="what-if" title="What if…">
      <p>
        <strong>
          …the readiness probe fails while the container keeps running?
        </strong>{" "}
        Nothing is restarted. The EndpointSlice controller removes the
        Pod&apos;s IP address from the EndpointSlices of every Service that
        matches the Pod, so it stops getting traffic.{cite("pod-lifecycle")}
      </p>
      <p>
        <strong>
          …the app is slow to start and the liveness probe kills it every time?
        </strong>{" "}
        A startup probe holds back the liveness and readiness probes until it
        succeeds, giving the app time to initialize; or delay the liveness probe
        with <code>initialDelaySeconds</code>.{cite("pod-lifecycle")}
      </p>
      <p>
        <strong>
          …the image tag is <code>latest</code>?
        </strong>{" "}
        With no policy set, the pull policy becomes <code>Always</code>, and the
        runtime resolves the tag again each time the kubelet starts the
        container.{cite("images")}
      </p>
      <p>
        <strong>…the whole node dies?</strong> The kubelet can&apos;t restart
        anything then. The Pods on it are marked for deletion after a timeout,
        and replacements come from their controllers.{cite("pod-lifecycle")}
      </p>
    </WriteupSection>
  </>
);

/** Trace: the kubelet starts a Pod through CRI, then a crash loop and a liveness failure. */
export function Body() {
  return (
    <Prose>
      {intro}
      <Trace spec={trace} title="Pod web-1 · node-1 · restartPolicy: Always" />
      {after}
    </Prose>
  );
}
