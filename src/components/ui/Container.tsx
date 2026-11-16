import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** The site's page width: max-w-6xl, centred, with the standard 24px side gutter. */
export function Container({ as: As = "div", className, children }: { as?: "div" | "main" | "section" | "header"; className?: string; children: ReactNode }) {
  return <As className={cx("mx-auto w-full max-w-6xl px-6", className)}>{children}</As>;
}
