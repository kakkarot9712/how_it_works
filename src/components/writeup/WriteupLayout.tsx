import type { ReactNode } from "react";
import { Container, cx } from "@/components/ui";

/**
 * Two-column write-up layout: a 200px rail (contents list, wide screens only) and a
 * text column capped at max-w-3xl. The header uses the same grid so its left edge
 * lines up with the text column.
 */
export function WriteupGrid({ rail, children, className }: { rail?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Container className={cx("grid gap-12 xl:grid-cols-[200px_minmax(0,1fr)]", className)}>
      <aside className="hidden xl:block">{rail && <div className="sticky top-20">{rail}</div>}</aside>
      <div className="min-w-0 max-w-3xl">{children}</div>
    </Container>
  );
}
