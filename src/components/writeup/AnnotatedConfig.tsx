import { cx } from "@/lib/cx";
import { Surface, toneText } from "@/components/ui";

/** A config line with each argument labelled underneath. */
export function AnnotatedConfig({ parts }: { parts: { token: string; label?: string; tone?: "accent" | "warn" | "err" }[] }) {
  return (
    <Surface className="not-prose my-5 overflow-x-auto px-5 py-4">
      <div className="inline-flex gap-x-4 font-mono">
        {parts.map((p, i) => (
          <div key={i} className="flex flex-col">
            <span
              className={cx("text-body whitespace-nowrap", p.tone ? toneText[p.tone] : "text-fg")}
            >
              {p.token}
            </span>
            {p.label && (
              <span className="mt-1.5 border-t border-line pt-1 font-sans text-xs whitespace-nowrap text-fg-muted">
                {p.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </Surface>
  );
}
