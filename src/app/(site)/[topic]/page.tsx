import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTopic, topics } from "@/catalog";
import { SimCard } from "@/components/SimCard";

export function generateStaticParams() {
  return topics.map((t) => ({ topic: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[topic]">): Promise<Metadata> {
  const t = getTopic((await params).topic);
  return t ? { title: t.name, description: t.tagline } : {};
}

/** Params are read inside <Suspense> so navigation can show the shell instantly. */
export default function TopicPage({ params }: PageProps<"/[topic]">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-14">
      <Link href="/#topics" className="text-xs text-fg-muted hover:text-fg">
        ← all topics
      </Link>
      <Suspense fallback={<div className="mt-3 h-40" aria-hidden />}>
        <TopicContent params={params} />
      </Suspense>
    </main>
  );
}

async function TopicContent({ params }: { params: PageProps<"/[topic]">["params"] }) {
  const t = getTopic((await params).topic);
  if (!t) notFound();
  return (
    <>
      <h1 className="mt-3 text-3xl font-semibold text-fg">{t.name}</h1>
      <p className="mt-2 text-sm text-fg-muted">{t.tagline}</p>
      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {t.sims.map((s) => (
          <SimCard key={s.slug} topic={t} sim={s} />
        ))}
      </div>
    </>
  );
}
