/** The live, real-syntax config line a node is running with (e.g. `client-output-buffer-limit pubsub 16kb 8kb 5`). */
export function ConfigLine({ children }: { children: string }) {
  return <pre className="mt-2 overflow-x-auto rounded-md bg-bg px-2 py-1.5 font-mono text-note text-fg">{children}</pre>;
}
