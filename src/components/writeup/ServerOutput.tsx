import { Surface } from "@/components/ui";

/** Verbatim output from the system (an error with its DETAIL and HINT, a log line), as a boxed monospace block. */
export function ServerOutput({ children }: { children: string }) {
  return (
    <Surface className="not-prose my-4 overflow-x-auto px-4 py-3">
      <pre className="font-mono text-note leading-relaxed text-fg">{children}</pre>
    </Surface>
  );
}
