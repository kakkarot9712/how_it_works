import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTopic, topics } from "@/catalog";
import { paths } from "@/paths/catalog";
import { PathCard, SimGrid } from "@/components/site";
import { Container, Heading } from "@/components/ui";

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
    <Container as="main" className="py-14">
      <Link href="/#topics" className="text-xs text-fg-muted hover:text-fg">
        ← all topics
      </Link>
      <Suspense fallback={<div className="mt-3 h-40" aria-hidden />}>
        <TopicContent params={params} />
      </Suspense>
    </Container>
  );
}

async function TopicContent({ params }: { params: PageProps<"/[topic]">["params"] }) {
  const t = getTopic((await params).topic);
  if (!t) notFound();
  return (
    <>
      <Heading level="title" as="h1" className="mt-3">
        {t.name}
      </Heading>
      <p className="mt-2 text-sm text-fg-muted">{t.tagline}</p>
      {paths
        .filter((p) => p.topic === t.slug)
        .map((p) => (
          <div key={p.slug} className="mt-8 max-w-2xl">
            <PathCard path={p} />
          </div>
        ))}
      <div className="mt-8">
        <SimGrid topic={t} />
      </div>
    </>
  );
}
