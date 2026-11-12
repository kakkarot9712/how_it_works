import { NextResponse, type NextRequest } from "next/server";
import { getSim, getTopic } from "@/catalog";

/**
 * Real 404 status for unknown topic/sim URLs.
 *
 * The dynamic pages read params inside <Suspense> (for instant navigation),
 * so by the time they call notFound() a 200 has already been streamed.
 * Checking the static catalog here, before rendering, keeps the status
 * honest. This check must stay cheap: no I/O.
 */
export function proxy(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  const [topic, sim, sub] = parts;
  const ok =
    (parts.length === 1 && getTopic(topic)) ||
    (parts.length === 2 && getSim(topic, sim)?.sim.status === "live") ||
    (parts.length === 3 && sub === "how-it-works" && getSim(topic, sim)?.sim.status === "live");
  if (ok) return;
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

export const config = {
  // Everything except Next internals and files with an extension (favicon, images…).
  matcher: ["/((?!_next/|.*\\..*).+)"],
};
