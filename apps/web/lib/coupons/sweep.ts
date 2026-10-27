import { transaction } from "../db";
import { coupons } from "./instance";

/** The sweeper (ADR-002 §4.1 step 5): frees the uses that checkouts reserved and never paid for, once their deadline passed. Safe to run on every instance: the transition is guarded. */
export async function sweepCoupons(): Promise<number> {
  return transaction((tx) => coupons.releaseExpired(tx));
}
