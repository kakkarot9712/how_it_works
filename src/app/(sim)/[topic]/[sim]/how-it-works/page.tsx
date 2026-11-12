import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSim, topics } from "@/catalog";
import { SimNav } from "@/components/SimNav";
import { writeups } from "@/sims/explainers";

export function generateStaticParams() {
  return topics.flatMap((t) =>
    t.sims.filter((s) => s.status === "live" && writeups[`${t.slug}/${s.slug}`]).map((s) => ({ topic: t.slug, sim: s.slug })),
  );
}

export async function generateMetadata({ params }: PageProps<"/[topic]/[sim]/how-it-works">): Promise<Metadata> {
  const { topic, sim } = await params;
  const found = getSim(topic, sim);
  return found ? { title: `How ${found.topic.name} ${found.sim.title} works`, description: found.sim.summary } : {};
}

export default function HowItWorksPage({ params }: PageProps<"/[topic]/[sim]/how-it-works">) {
  return (
    <main>
      <Suspense fallback={<div className="h-12 border-b border-line bg-panel" />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/[topic]/[sim]/how-it-works">["params"] }) {
  const { topic, sim } = await params;
  const found = getSim(topic, sim);
  const writeup = writeups[`${topic}/${sim}`];
  if (!found || found.sim.status !== "live" || !writeup) notFound();
  const base = `/${topic}/${sim}`;
  const { Explainer } = writeup;

  return (
    <>
      <SimNav topic={found.topic} sim={found.sim} active="how-it-works" />
      <Explainer />
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-4 text-2xl font-semibold text-fg">See it happen</h2>
        <p className="mb-5 text-[15px] leading-7 text-fg-muted">
          Each scenario opens the simulator with one situation set up. Once it&apos;s running, you can take control.
        </p>
        <ol className="space-y-2">
          {writeup.scenarios.map((s, i) => (
            <li key={s.id}>
              <Link
                href={`${base}?s=${s.id}`}
                className="block rounded-lg border border-line bg-panel px-4 py-3 transition-colors hover:border-accent/60"
              >
                <div className="flex gap-3 text-base text-fg">
                  <span className="font-mono text-sm leading-6 text-fg-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-medium">{s.title}</span>
                  <span className="ml-auto text-sm leading-6 text-accent">open →</span>
                </div>
                <p className="mt-1 pl-8 text-sm leading-relaxed text-fg-muted">{s.summary}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
