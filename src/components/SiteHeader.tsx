import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-mono text-sm text-fg">
      <span className="inline-block h-2 w-2 rounded-full bg-accent" />
      syswork
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-5 backdrop-blur">
      <Logo />
      <nav className="flex gap-5 text-sm text-fg-muted">
        <Link href="/#topics" className="hover:text-fg">
          Topics
        </Link>
        <a href="https://vikalpg.in" className="hover:text-fg">
          vikalpg.in
        </a>
      </nav>
    </header>
  );
}
