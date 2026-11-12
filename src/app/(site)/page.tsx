import Link from "next/link";
import { topics } from "@/catalog";
import { SimCard } from "@/components/SimCard";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24">
      <section className="py-20">
        <p className="font-mono text-xs text-accent">$ syswork --explain</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-fg">
          See how systems actually work. Then break them.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted">
          Animated simulations of real system internals: message brokers, load balancers, replication, transactions.
          Stall a consumer, cut a network link, crash a node, or pull a component out entirely. Then watch, step by step,
          what the system does and why.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/redis/pub-sub"
            className="rounded-md border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/25"
          >
            Start with Redis Pub/Sub →
          </Link>
        </div>
      </section>

      <section id="topics" className="space-y-12">
        {topics.map((t) => (
          <div key={t.slug}>
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-lg font-semibold text-fg">
                <Link href={`/${t.slug}`} className="hover:text-accent">
                  {t.name}
                </Link>
              </h2>
              <span className="text-xs text-fg-muted">{t.tagline}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted/70">{t.kind}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {t.sims.map((s) => (
                <SimCard key={s.slug} topic={t} sim={s} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
