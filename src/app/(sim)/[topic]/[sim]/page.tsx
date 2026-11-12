import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSim, topics } from "@/catalog";
import { SimNav } from "@/components/SimNav";
import { SimMount } from "@/sims/registry";

export function generateStaticParams() {
  return topics.flatMap((t) => t.sims.filter((s) => s.status === "live").map((s) => ({ topic: t.slug, sim: s.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[topic]/[sim]">): Promise<Metadata> {
  const { topic, sim } = await params;
  const found = getSim(topic, sim);
  return found ? { title: `${found.topic.name} ${found.sim.title} simulator`, description: found.sim.summary } : {};
}

/**
 * The simulator fills the viewport (no site header on sim pages). Params are read
 * inside <Suspense> so client navigation can show the shell instantly.
 */
export default function SimPage({ params }: PageProps<"/[topic]/[sim]">) {
  return (
    <main className="flex h-dvh min-h-[600px] flex-col">
      <Suspense fallback={<div className="h-12 border-b border-line bg-panel" />}>
        <SimContent params={params} />
      </Suspense>
    </main>
  );
}

async function SimContent({ params }: { params: PageProps<"/[topic]/[sim]">["params"] }) {
  const { topic, sim } = await params;
  const found = getSim(topic, sim);
  if (!found || found.sim.status !== "live") notFound();
  return (
    <>
      <SimNav topic={found.topic} sim={found.sim} active="simulator" />
      <div className="min-h-0 flex-1">
        <SimMount id={`${topic}/${sim}`} />
      </div>
    </>
  );
}
