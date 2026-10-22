import type { Clock } from "@/lib/api-keys";

/** The wall clock, given to the code that must not read it itself (`lib/**` takes a `Clock` or a `now`). Routes and pages pass this one. */
export const systemClock: Clock = { now: () => new Date() };
