import Link from "next/link";
import { cx } from "@/lib/cx";
import { Logo } from "./SiteHeader";
import type { SimEntry, Topic } from "@/catalog";

/** Top bar for a sim's two pages (simulator, write-up): logo, breadcrumb, tabs. */
export function SimNav({ topic, sim, active }: { topic: Topic; sim: SimEntry; active: "simulator" | "how-it-works" }) {
  const base = `/${topic.slug}/${sim.slug}`;
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={cx(
        "relative flex h-full items-center px-1 text-sm transition-colors",
        on ? "text-fg after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent" : "text-fg-muted hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-6 border-b border-line bg-panel px-5">
      <Logo />
      <span className="h-5 w-px bg-line" />
      <div className="flex items-center gap-1.5 text-sm">
        <Link href={`/${topic.slug}`} className="text-fg-muted hover:text-fg">
          {topic.name}
        </Link>
        <span className="text-fg-muted">/</span>
        <h1 className="font-semibold text-fg">{sim.title}</h1>
      </div>
      <nav className="flex h-full items-center gap-5">
        {tab(base, "Simulator", active === "simulator")}
        {tab(`${base}/how-it-works`, "How it works", active === "how-it-works")}
      </nav>
    </div>
  );
}
