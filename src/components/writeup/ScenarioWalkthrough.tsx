import Link from "next/link";
import type { Walkthrough } from "@/sims/explainers";
import { Eyebrow, Heading, LinkButton, surfaceClass } from "@/components/ui";
import { Rich } from "./Rich";

/** One scenario, moment by moment, with deep links into the simulator at each moment. */
export function ScenarioWalkthrough({
  n,
  title,
  summary,
  href,
  walkthrough: w,
}: {
  n: number;
  title: string;
  summary: string;
  /** Simulator link for this scenario (`…?s=<id>`). Moments append `&t=<ms>`. */
  href: string;
  walkthrough: Walkthrough;
}) {
  // One tooltip per acronym per card.
  const seen = new Set<string>();
  return (
    <article id={`scenario-${w.id}`} className={surfaceClass({ radius: "xl" }, "scroll-mt-20 overflow-hidden")}>
      <header className="flex items-start gap-4 border-b border-line px-5 py-4">
        <span className="mt-1 font-mono text-sm text-accent">{String(n).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <Heading level="card" as="h3">
            {title}
          </Heading>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">{summary}</p>
        </div>
        <LinkButton href={href} className="shrink-0">
          ▶ Run it
        </LinkButton>
      </header>

      <div className="space-y-5 px-5 py-5 text-body leading-relaxed text-fg-muted">
        <p>
          <Eyebrow as="span" className="mr-2">Setup</Eyebrow>
          <Rich seen={seen} text={w.setup} />
        </p>

        <ol className="relative space-y-3 border-l border-line pl-0">
          {w.moments.map((m, i) => (
            <li key={i} className="relative grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-3 pl-4">
              <span aria-hidden className="absolute -left-[4.5px] top-[0.55em] h-2 w-2 rounded-full bg-line" />
              {m.t !== undefined ? (
                <Link
                  href={`${href}&t=${m.t + 300}`}
                  title="Open the simulator paused at this moment"
                  className={surfaceClass(
                    { level: "raised", radius: "sm", interactive: true },
                    "justify-self-start px-1.5 py-0.5 font-mono text-xs tabular-nums text-fg hover:text-accent",
                  )}
                >
                  {(m.t / 1000).toFixed(1)}s
                </Link>
              ) : (
                <span className="justify-self-start px-1.5 font-mono text-xs text-fg-muted/60">ongoing</span>
              )}
              <span>
                <Rich seen={seen} text={m.text} />
              </span>
            </li>
          ))}
        </ol>

        <p className="border-l-2 border-accent pl-4 text-fg">
          <Rich seen={seen} text={w.takeaway} />
        </p>

        {w.tryNext.length > 0 && (
          <div>
            <Eyebrow className="mb-1.5">Try next</Eyebrow>
            <ul className="list-disc space-y-1 pl-5 marker:text-fg-muted/60">
              {w.tryNext.map((t, i) => (
                <li key={i}>
                  <Rich seen={seen} text={t} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
