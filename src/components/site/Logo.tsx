import Link from "next/link";

/** The syswork wordmark, linking home. */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-mono text-sm text-fg">
      <span className="inline-block h-2 w-2 rounded-full bg-accent" />
      syswork
    </Link>
  );
}
