import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSim, topics } from "@/catalog";
import { SimNav } from "@/components/site";
import { LinkButton } from "@/components/ui";
import { References, ScenarioWalkthroughs, Toc, WriteupGrid, WriteupHero } from "@/components/writeup";
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

  const walkthroughsTitle = "Every scenario, step by step";
  const referencesTitle = "References";

  return (
    <>
      <SimNav topic={found.topic} sim={found.sim} active="how-it-works" />
      <WriteupHero
        eyebrow={`${found.topic.name} · ${found.sim.title} · how it works`}
        title={writeup.title}
        lede={writeup.lede}
        facts={writeup.facts}
        modelledOn={`${writeup.sources.subject} ${writeup.sources.version}`}
        actions={
          <>
            <LinkButton href={base} size="lg">
              ▶ Open the simulator
            </LinkButton>
            <a href="#scenarios" className="px-2 py-2 text-sm text-fg-muted transition-colors hover:text-fg">
              {writeup.scenarios.length} scenarios ↓
            </a>
          </>
        }
      />
      <WriteupGrid className="py-14" rail={
          <Toc
            sections={[...writeup.sections, { id: "scenarios", title: walkthroughsTitle }, { id: "references", title: referencesTitle }]}
          />
        }>
        <Explainer simHref={base} />
        <ScenarioWalkthroughs
          title={walkthroughsTitle}
          simHref={base}
          scenarios={writeup.scenarios}
          walkthroughs={writeup.walkthroughs}
        />
        <References title={referencesTitle} sources={writeup.sources} />
      </WriteupGrid>
    </>
  );
}
