import Link from "next/link";
import { topics } from "@/catalog";
import { paths } from "@/paths/catalog";
import { PathCard, SimGrid } from "@/components/site";
import { Container, Eyebrow, Heading, LinkButton } from "@/components/ui";

export default function Home() {
  return (
    <Container as="main" className="pb-24">
      <section className="py-20">
        <p className="font-mono text-xs text-accent">$ syswork --explain</p>
        <Heading level="display" as="h1" className="mt-3 max-w-3xl leading-tight">
          See how systems actually work. Then break them.
        </Heading>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted">
          Learning paths that take one system apart, idea by idea: explore a mechanism, trace a request hop by hop, then
          predict what a failure does and break it in a simulator to check. Stall a consumer, cut a link, crash a node, or
          pull a component out entirely, and see what the system does and why.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href="/learn/kafka" size="lg">
            Start the Kafka path →
          </LinkButton>
          <LinkButton href="#topics" size="lg" tone="ghost">
            Browse simulators ↓
          </LinkButton>
        </div>
      </section>

      <section id="paths" className="mb-16 scroll-mt-20">
        <Heading level="section" className="mb-4">
          Learning paths
        </Heading>
        <div className="grid gap-3 md:grid-cols-2">
          {paths.map((p) => (
            <PathCard key={p.slug} path={p} />
          ))}
        </div>
      </section>

      <section id="topics" className="scroll-mt-20 space-y-12">
        <Heading level="section">Simulators</Heading>
        {topics.map((t) => (
          <div key={t.slug}>
            <div className="mb-4 flex items-baseline gap-3">
              <Heading level="card">
                <Link href={`/${t.slug}`} className="transition-colors hover:text-accent">
                  {t.name}
                </Link>
              </Heading>
              <span className="text-xs text-fg-muted">{t.tagline}</span>
              <Eyebrow as="span" size="sm" className="font-mono">
                {t.kind}
              </Eyebrow>
            </div>
            <SimGrid topic={t} />
          </div>
        ))}
      </section>
    </Container>
  );
}
