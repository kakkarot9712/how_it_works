import type { ReactNode } from "react";

/** Typography for long-form explanations under a simulation. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <article
      className={[
        "mx-auto max-w-3xl px-6 py-14 text-[16px] leading-[1.8] text-fg-muted",
        "[&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-fg",
        "[&_h3]:mb-2 [&_h3]:mt-10 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-fg",
        "[&_p]:my-3 [&_strong]:text-fg [&_em]:text-fg",
        "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
        "[&_code]:rounded [&_code]:bg-panel-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-fg",
        "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-line [&_pre]:bg-panel [&_pre]:p-4",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
      ].join(" ")}
    >
      {children}
    </article>
  );
}
