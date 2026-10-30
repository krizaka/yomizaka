/** The instant the console writes as « today »: the real one, except in a dev visual run that froze it (`APP_VISUAL_NOW`), so a capture never depends on the day. Never in production. */
export function displayNow(now: Date, environment: "dev" | "prod", frozenAt: string | undefined): Date {
  return environment === "dev" && frozenAt ? new Date(frozenAt) : now;
}
