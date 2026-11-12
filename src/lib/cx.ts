/** Join class names, skipping falsy values. Safe in server and client components. */
export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}
