import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass, type ButtonTone } from "./Button";

/** A Next.js link styled as a button. Server-safe. `size="lg"` for page-level calls to action. */
export function LinkButton({
  href,
  children,
  tone = "primary",
  size = "md",
  title,
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: ButtonTone;
  size?: "md" | "lg";
  title?: string;
  className?: string;
}) {
  return (
    <Link href={href} title={title} className={buttonClass(tone, className, size)}>
      {children}
    </Link>
  );
}
