import Link from "next/link";
import { topics } from "@/catalog";
import { SimGrid } from "@/components/site";
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
          Animated simulations of real system internals: message brokers, load balancers, replication.
          Stall a consumer, cut a network link, crash a node, or pull a component out entirely. Then watch, step by step,
          what the system does and why.
        </p>
        <div className="mt-8 flex gap-3">
          <LinkButton href="/redis/pub-sub" size="lg">
            Start with Redis Pub/Sub →
          </LinkButton>
        </div>
      </section>

      <section id="topics" className="space-y-12">
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
