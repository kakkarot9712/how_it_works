"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { Eyebrow } from "@/components/ui";

/** Sticky "on this page" list that highlights the section being read. */
export function Toc({ sections }: { sections: { id: string; title: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const onScroll = () => {
      // The last section whose heading has scrolled past the top third of the viewport.
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.3) current = s.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections]);

  return (
    <nav aria-label="On this page" className="text-sm">
      <Eyebrow className="mb-3">On this page</Eyebrow>
      <ul className="space-y-0.5 border-l border-line">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={cx(
                "-ml-px block border-l-2 py-1 pl-3 leading-snug transition-colors",
                active === s.id ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg",
              )}
            >
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
