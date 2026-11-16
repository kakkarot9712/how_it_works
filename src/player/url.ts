/**
 * Deep links into the simulator: `?s=<scenario>&t=<ms>` opens a scenario paused at a moment.
 * The write-up, "Link to moment" and verify-simulation screenshots all rely on this format.
 */

export function readSimUrl(scenarioIds: string[]): { scenarioId: string; t: number } {
  const q = new URLSearchParams(window.location.search);
  const id = q.get("s");
  const t = Number(q.get("t"));
  return {
    scenarioId: id && scenarioIds.includes(id) ? id : scenarioIds[0],
    t: Number.isFinite(t) && t > 0 ? t : 0,
  };
}

/** Replace the current URL with `?s=<id>` (no history entry). */
export function writeScenarioUrl(id: string) {
  window.history.replaceState(null, "", `?s=${id}`);
}

/** Absolute link to this page's simulator at a scenario and moment. */
export function momentUrl(scenarioId: string, t: number) {
  return `${window.location.origin}${window.location.pathname}?s=${scenarioId}&t=${Math.round(t)}`;
}
