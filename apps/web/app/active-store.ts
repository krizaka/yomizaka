import { env } from "@/lib/env";
import { storageFrom } from "@/lib/storage/config";

/** The documents store configured now (the edge reads the environment and the clock; the domain receives them). */
export const activeStore = () => storageFrom(env(), () => new Date());
