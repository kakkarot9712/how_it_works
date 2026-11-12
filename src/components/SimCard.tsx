import Link from "next/link";
import type { SimEntry, Topic } from "@/catalog";

export function SimCard({ topic, sim }: { topic: Topic; sim: SimEntry }) {
  const live = sim.status === "live";
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{sim.title}</h3>
        <span
          className={
            live
              ? "rounded-full border border-ok/40 bg-ok/10 px-2 py-0.5 text-[10px] text-ok"
              : "rounded-full border border-line px-2 py-0.5 text-[10px] text-fg-muted"
          }
        >
          {live ? "live" : "planned"}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-fg-muted">{sim.summary}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {sim.concepts.map((c) => (
          <span key={c} className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
            {c}
          </span>
        ))}
      </div>
    </>
  );
  const cls = "block rounded-xl border border-line bg-panel p-4 transition-colors";
  return live ? (
    <Link href={`/${topic.slug}/${sim.slug}`} className={`${cls} hover:border-accent/60`}>
      {body}
    </Link>
  ) : (
    <div className={`${cls} opacity-60`}>{body}</div>
  );
}
