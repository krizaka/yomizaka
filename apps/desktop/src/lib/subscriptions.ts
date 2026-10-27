/** The native side hands back each subscription as a promise of its stop: one cleanup that stops them all. */
export function stopAll(stops: readonly Promise<() => void>[]): () => void {
  return () => void Promise.all(stops).then((all) => all.forEach((stop) => stop()));
}
