import type { SourceSet } from "@/lib/sources";

/**
 * Every claim in this module (model narration, canvas, inspector, scenarios, walkthroughs,
 * write-up) must be supported by one of these. Ordered by first citation in the Explainer.
 * See the `source-facts` skill before adding a claim or a reference.
 */
export const sources: SourceSet = {
  subject: "nginx",
  version: "1.30",
  label: "nginx 1.30",
  versionNote:
    "Balancing methods, server parameters and their defaults are from the nginx 1.30 documentation; the selection and failure accounting follow the release-1.30.6 source. Features newer than a method's first release are marked with their version (random, 1.15.1+); least_time is left out because it was commercial-only before 1.31.0.",
  checked: "2026-11-17",
  officialSources: ["https://nginx.org/en/", "https://github.com/nginx/nginx/", "https://www.rfc-editor.org/rfc/"],
  references: [
    {
      id: "lb-guide",
      title: "Using nginx as HTTP load balancer",
      publisher: "nginx documentation",
      url: "https://nginx.org/en/docs/http/load_balancing.html",
      accessed: "2026-11-17",
      covers: ["upstream", "server", "proxy_pass", "least_conn", "ip_hash", "weight", "max_fails", "fail_timeout", "proxy_next_upstream", "backup", "down"],
    },
    {
      id: "upstream",
      title: "Module ngx_http_upstream_module",
      publisher: "nginx documentation",
      url: "https://nginx.org/en/docs/http/ngx_http_upstream_module.html",
      accessed: "2026-11-17",
      covers: [
        "upstream", "server", "weight", "max_conns", "max_fails", "fail_timeout", "backup", "down", "zone",
        "least_conn", "least_time", "random", "two", "ip_hash", "hash", "slow_start",
      ],
    },
    {
      id: "rr-c",
      title: "src/http/ngx_http_upstream_round_robin.c (release-1.30.6)",
      publisher: "nginx source repository",
      url: "https://github.com/nginx/nginx/blob/release-1.30.6/src/http/ngx_http_upstream_round_robin.c",
      accessed: "2026-11-17",
      covers: ["current_weight", "effective_weight", "conns", "fails", "checked", "accessed", "upstream server temporarily disabled"],
    },
    {
      id: "lc-c",
      title: "src/http/modules/ngx_http_upstream_least_conn_module.c (release-1.30.6)",
      publisher: "nginx source repository",
      url: "https://github.com/nginx/nginx/blob/release-1.30.6/src/http/modules/ngx_http_upstream_least_conn_module.c",
      accessed: "2026-11-17",
      covers: ["least_conn", "conns", "current_weight", "effective_weight"],
    },
    {
      id: "random-c",
      title: "src/http/modules/ngx_http_upstream_random_module.c (release-1.30.6)",
      publisher: "nginx source repository",
      url: "https://github.com/nginx/nginx/blob/release-1.30.6/src/http/modules/ngx_http_upstream_random_module.c",
      accessed: "2026-11-17",
      covers: ["random", "two", "conns"],
    },
    {
      id: "proxy",
      title: "Module ngx_http_proxy_module",
      publisher: "nginx documentation",
      url: "https://nginx.org/en/docs/http/ngx_http_proxy_module.html",
      accessed: "2026-11-17",
      covers: ["proxy_next_upstream", "proxy_read_timeout", "proxy_next_upstream_tries", "proxy_next_upstream_timeout", "non_idempotent", "POST", "LOCK", "PATCH"],
    },
    {
      id: "rfc9293",
      title: "RFC 9293: Transmission Control Protocol (TCP)",
      publisher: "IETF",
      url: "https://www.rfc-editor.org/rfc/rfc9293.html",
      accessed: "2026-11-17",
      covers: [],
    },
    {
      id: "upstream-c",
      title: "src/http/ngx_http_upstream.c (release-1.30.6)",
      publisher: "nginx source repository",
      url: "https://github.com/nginx/nginx/blob/release-1.30.6/src/http/ngx_http_upstream.c",
      accessed: "2026-11-17",
      covers: ["no live upstreams", "upstream timed out"],
    },
    {
      id: "download",
      title: "nginx: download (mainline 1.31, stable 1.30)",
      publisher: "nginx.org",
      url: "https://nginx.org/en/download.html",
      accessed: "2026-11-17",
      covers: [],
    },
  ],
};
