import { Trace, type TraceSpec } from "@/components/path";
import { citer, Prose, simplifier, WriteupSection } from "@/components/writeup";
import { pickSources } from "@/lib/sources";
import { pool } from "../sources";

export const sources = pickSources(pool, [
  "service",
  "virtual-ips",
  "kcm-flags",
  "endpointslices",
  "api-concepts",
  "components",
  "dns",
  "pod-lifecycle",
]);
const cite = citer(sources);
const simplified = simplifier(sources);

const intro = (
  <WriteupSection id="setup" title="A stable address for Pods that come and go">
    <p>
      Pods get replaced, and each new one gets a new IP. A Service gives a set
      of Pods, chosen by a label selector (the Service&apos;s{" "}
      <code>selector</code> field), one stable address: Kubernetes assigns it a
      cluster IP, used by the virtual IP mechanism.{cite("service")} On each
      node, kube-proxy implements that mechanism by programming the node&apos;s
      packet rules.{cite("virtual-ips")}
    </p>
    <p>
      This trace creates Service <code>web</code> (<code>port</code> 80 to{" "}
      <code>targetPort</code> 9376, the docs&apos; own example) in front of two
      Pods, sends one request from a client Pod, then takes one backend out by
      failing its readiness probe.
    </p>
  </WriteupSection>
);

export const trace: TraceSpec = {
  actors: [
    { id: "api", label: "kube-apiserver" },
    { id: "eps", label: "controller-mgr", sub: "EndpointSlice ctrl" },
    { id: "proxy", label: "kube-proxy", sub: "node-a" },
    { id: "client", label: "client", sub: "Pod on node-a" },
    { id: "web1", label: "web-1", sub: "Pod 10.244.1.5" },
  ],
  state: {
    fields: [
      { id: "svc", label: "Service web's cluster IP", short: "IP" },
      {
        id: "eps",
        label: "Ready endpoints in its EndpointSlice",
        short: "ready",
      },
      {
        id: "rules",
        label: "Backends in node-a's rules for web",
        short: "rules",
      },
      { id: "dst", label: "Where the client's packets go", short: "to" },
    ],
    initial: {
      api: { svc: "—", eps: "—" },
      proxy: { rules: "none" },
      client: { dst: "—" },
    },
  },
  hops: [
    {
      from: "api",
      to: "api",
      label: "create Service web",
      simplified: simplified(
        ["service"],
        <>
          The cluster IP and Pod IPs here are examples. web-2 and its node are
          left out of the drawing.
        </>,
      ),
      title: "The Service is stored and gets a cluster IP.",
      set: { api: { svc: "10.96.0.10" } },
      body: (
        <>
          A Service of the default type <code>ClusterIP</code> gets an IP
          address assigned by Kubernetes, the cluster IP.{cite("service")} No
          Pod has this address; it exists only in rules.{cite("virtual-ips")}
        </>
      ),
    },
    {
      from: "api",
      to: "eps",
      label: "watch: ADDED Service",
      reply: true,
      title: "The EndpointSlice controller sees a Service with a selector.",
      body: (
        <>
          <code>endpointslice-controller</code> runs in kube-controller-manager.
          {cite("kcm-flags")} The control plane creates EndpointSlices for every
          Service that has a selector, listing the Pods that match it.
          {cite("endpointslices")} The news arrives on its watch as an{" "}
          <code>ADDED</code> event.{cite("api-concepts")}
        </>
      ),
    },
    {
      from: "eps",
      to: "api",
      label: "create EndpointSlice",
      title: "It writes the Pods' addresses into an EndpointSlice.",
      set: { api: { eps: "2" } },
      body: (
        <>
          Each endpoint has an address and conditions; <code>ready</code> is
          short for serving and not terminating, and serving maps to the
          Pod&apos;s Ready condition.{cite("endpointslices")} web-1 and web-2
          are both Ready.
        </>
      ),
    },
    {
      from: "api",
      to: "proxy",
      label: "watch: Service, EndpointSlice",
      reply: true,
      title: "kube-proxy on every node hears about both.",
      body: (
        <>
          Each kube-proxy watches the control plane for Service and
          EndpointSlice objects.{cite("virtual-ips")} It is optional: a cluster
          may use another component in its place.{cite("components")}
        </>
      ),
    },
    {
      from: "proxy",
      to: "proxy",
      label: "program iptables",
      simplified: simplified(
        ["virtual-ips"],
        <>
          kube-proxy runs on every node; only node-a&apos;s is drawn, because
          the client&apos;s packets are rewritten on node-a.
        </>,
      ),
      title: "It writes rules into node-a's kernel. Then it steps aside.",
      set: { proxy: { rules: "2 Pods" } },
      body: (
        <>
          In <code>iptables</code> mode, the default in 1.37, kube-proxy
          installs rules that redirect the Service&apos;s IP to per-Service
          rules, and from there to one rule per endpoint, which rewrites the
          destination (<code>DNAT</code>).{cite("virtual-ips")}
        </>
      ),
    },
    {
      from: "client",
      to: "client",
      label: "DNS: web → 10.96.0.10",
      simplified: simplified(
        ["dns"],
        <>
          Drawn as one step inside the client; how the cluster answers the
          lookup is left out.
        </>,
      ),
      title: "The client finds the Service by name.",
      set: { client: { dst: "10.96.0.10" } },
      body: (
        <>
          Services get DNS names that resolve to their cluster IP. The kubelet
          sets up each Pod&apos;s <code>/etc/resolv.conf</code>, so a bare{" "}
          <code>web</code> expands to <code>web.default.svc.cluster.local</code>{" "}
          in the Pod&apos;s own namespace.{cite("dns")}
        </>
      ),
    },
    {
      from: "client",
      to: "client",
      label: "rules: DNAT → 10.244.1.5:9376",
      title: "On the way out of node-a, the rules pick a backend.",
      set: { client: { dst: "web-1:9376" } },
      body: (
        <>
          When a client connects to the Service&apos;s IP, the rules choose a
          backend, at random unless session affinity is set, and redirect the
          packets to it without rewriting the client&apos;s IP.
          {cite("virtual-ips")} The port becomes the <code>targetPort</code>.
          {cite("service")}
        </>
      ),
    },
    {
      from: "client",
      to: "web1",
      label: "TCP to 10.244.1.5:9376",
      title: "The packets go straight to the Pod.",
      body: (
        <>
          kube-proxy is not on this path: the kernel rules it wrote did the
          work.{cite("virtual-ips")} The connection is between the two Pods.
        </>
      ),
    },
    {
      from: "web1",
      to: "client",
      label: "response",
      reply: true,
      title: "web-1 answers.",
      body: (
        <>
          It sees the client&apos;s real IP, because the rules rewrote only the
          destination.{cite("virtual-ips")}
        </>
      ),
    },
    {
      from: "web1",
      to: "web1",
      label: "readiness ✕",
      title: "web-1 starts failing its readiness probe.",
      body: (
        <>
          Its container keeps running, so nothing restarts it. The kubelet marks
          the Pod not Ready, and the EndpointSlice controller removes its IP
          from the EndpointSlices of every Service that matches it.
          {cite("pod-lifecycle")}
        </>
      ),
    },
    {
      from: "eps",
      to: "api",
      label: "update EndpointSlice",
      title: "web-1's endpoint is no longer ready.",
      set: { api: { eps: "1" } },
      body: (
        <>
          The EndpointSlice now lists only web-2 as ready.
          {cite("pod-lifecycle", "endpointslices")}
        </>
      ),
    },
    {
      from: "api",
      to: "proxy",
      label: "watch: MODIFIED EndpointSlice",
      reply: true,
      title: "kube-proxy sees the change.",
      body: (
        <>
          The same watch delivers the update to every node&apos;s kube-proxy.
          {cite("virtual-ips")}
        </>
      ),
    },
    {
      from: "proxy",
      to: "proxy",
      label: "re-sync rules",
      title: "It rewrites the rules: one backend left.",
      set: { proxy: { rules: "1 Pod" } },
      body: (
        <>
          In clusters with many Services and Pods this sync can take a long
          time, since there are rules for every Service and every endpoint.
          {cite("virtual-ips")}
        </>
      ),
    },
    {
      from: "client",
      to: "client",
      label: "new connection → web-2",
      title: "New connections now reach only web-2.",
      set: { client: { dst: "web-2:9376" } },
      body: (
        <>
          The client never noticed: it still talks to 10.96.0.10, and the rules
          picked the only ready backend.{cite("virtual-ips")}
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
          <strong>A cluster IP is a rule, not a machine.</strong> Nothing
          listens on it; each node&apos;s rules rewrite it to a Pod IP.
          {cite("virtual-ips")}
        </li>
        <li>
          <strong>kube-proxy configures, it doesn&apos;t forward.</strong> It
          watches Services and EndpointSlices and writes rules; packets never
          pass through the kube-proxy process.{cite("virtual-ips")}
        </li>
        <li>
          <strong>Readiness decides who gets traffic.</strong> Not Ready means
          out of the EndpointSlice, then out of the rules.
          {cite("pod-lifecycle")}
        </li>
      </ul>
    </WriteupSection>

    <WriteupSection id="what-if" title="What if…">
      <p>
        <strong>…the client is in another namespace?</strong> A query for{" "}
        <code>web</code> is limited to the client&apos;s own namespace and finds
        nothing; ask for <code>web.default</code>.{cite("dns")}
      </p>
      <p>
        <strong>
          …web-1 wants to know who called it? Does it see the client&apos;s
          address?
        </strong>{" "}
        Inside the cluster, yes. Every packet carries two addresses: where it
        comes from (the source) and where it is going (the destination). Say the
        client Pod&apos;s IP is 10.244.0.9. Its packet leaves with source
        10.244.0.9 and destination 10.96.0.10:80, the Service. node-a&apos;s
        rules change only the destination, to 10.244.1.5:9376, and leave the
        source alone, so web-1 receives a packet from 10.244.0.9: the real
        client. That is what a backend logs, or checks against an allow list.
        {cite("virtual-ips")}
      </p>
      <p>
        Traffic from outside the cluster is different. When it comes in through
        a NodePort Service or a load balancer, the client&apos;s address does
        get changed on the way, so web-1 sees a different source address and
        can&apos;t tell from it who the caller was.{cite("virtual-ips")}
      </p>
      <p>
        <strong>…a Service has no selector?</strong> EndpointSlices are made
        automatically only for Services with a selector;{cite("endpointslices")}{" "}
        without one you supply them, for example to point the Service at a
        database outside the cluster.{cite("service")}
      </p>
      <p>
        <strong>…the cluster is large?</strong> Rule updates can lag behind
        EndpointSlice changes, because <code>iptables</code> mode writes rules
        for every Service and endpoint. The newer <code>nftables</code> mode is
        planned to become the default.{cite("virtual-ips")}
      </p>
    </WriteupSection>
  </>
);

/** Trace: a Service, its EndpointSlice, kube-proxy's rules, one request, and a backend leaving. */
export function Body() {
  return (
    <Prose>
      {intro}
      <Trace spec={trace} title="Service web · 80 → 9376 · iptables mode" />
      {after}
    </Prose>
  );
}
