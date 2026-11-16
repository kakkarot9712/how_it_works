import type { ReactNode } from "react";

/** A key or gesture in a hint ("↵", "Esc", "0"). Inline; pairs with plain muted text. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.25rem] items-center justify-center rounded border border-line bg-panel-2 px-1 font-mono text-2xs leading-4 text-fg">
      {children}
    </kbd>
  );
}
