import type { ReactNode } from "react";
import { Eyebrow, Surface } from "@/components/ui";

/** A boxed aside: a key takeaway, a caveat, or the "what this simplifies" list. */
export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn";
  title: string;
  children: ReactNode;
}) {
  return (
    <Surface as="aside" tone={tone === "warn" ? "warn" : undefined} className="my-6 px-5 py-4 [&>*:last-child]:mb-0 [&>p:first-of-type]:mt-1">
      <Eyebrow tone={tone === "warn" ? "warn" : "muted"} className="!my-0">
        {title}
      </Eyebrow>
      {children}
    </Surface>
  );
}
