import { NextResponse, type NextRequest } from "next/server";
import { getSim, getTopic } from "@/catalog";
import { getPath, getStep } from "@/paths/catalog";

/**
 * Real 404 status for unknown topic/sim and learning-path URLs.
 *
 * The dynamic pages read params inside <Suspense> (for instant navigation),
 * so by the time they call notFound() a 200 has already been streamed.
 * Checking the static catalog here, before rendering, keeps the status
 * honest. This check must stay cheap: no I/O.
 */
export function proxy(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  const [topic, sim, sub] = parts;
  const ok = topic === "learn" ? learnOk(parts.slice(1)) : topicOk();
  if (ok) return;
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });

  function topicOk() {
    return (
      (parts.length === 1 && !!getTopic(topic)) ||
      (parts.length === 2 && getSim(topic, sim)?.sim.status === "live") ||
      (parts.length === 3 && sub === "how-it-works" && getSim(topic, sim)?.sim.status === "live")
    );
  }
}

/** /learn, /learn/<path>, /learn/<path>/<step>. */
function learnOk([path, step, ...rest]: string[]): boolean {
  if (rest.length) return false;
  if (!path) return true;
  return step ? !!getStep(path, step) : !!getPath(path);
}

export const config = {
  // Everything except Next internals and files with an extension (favicon, images…).
  matcher: ["/((?!_next/|.*\\..*).+)"],
};
