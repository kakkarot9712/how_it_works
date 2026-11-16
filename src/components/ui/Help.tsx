import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { gloss } from "./gloss";

/** A short explanatory line under a control or stat block. */
export function Help({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("mt-2 text-note leading-snug text-fg-muted", className)}>{gloss(children)}</p>;
}
