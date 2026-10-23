import dns from "node:dns";
import https from "node:https";

import type { OutgoingRequest, Send } from "@krizaka/webhooks";

import { isPrivateAddress } from "./address";

/**
 * The HTTP call of a webhook (yomizaka#241): https only, no redirect followed, a short timeout, and the connection is made to an
 * address checked *at connect time* (a name that resolved to a public address when the endpoint was saved may resolve to the
 * server's own network later). Resolves with the status; throws when it could not connect or the address is private.
 */
export type Lookup = (host: string) => Promise<{ address: string; family: 4 | 6 }[]>;

const resolve: Lookup = async (host) => (await dns.promises.lookup(host, { all: true })) as { address: string; family: 4 | 6 }[];

export function safeSend(options: { timeoutMs: number; lookup?: Lookup }): Send {
  const lookup = options.lookup ?? resolve;
  return (request: OutgoingRequest) =>
    new Promise((done, fail) => {
      const url = new URL(request.url);
      if (url.protocol !== "https:") return fail(new Error("webhooks go to https addresses only"));
      const req = https.request(
        url,
        {
          method: "POST",
          headers: { ...request.headers, "content-type": "application/json", "content-length": Buffer.byteLength(request.body) },
          timeout: options.timeoutMs,
          // Only a checked address is ever connected to.
          lookup: (host, lookupOptions, callback) => {
            // Node asks for every address when it may try several (`all`), for one otherwise: answer in the shape it asked for.
            const answer = callback as unknown as (error: Error | null, address?: string | { address: string; family: number }[], family?: number) => void;
            lookup(host).then(
              (found) => {
                const bad = found.find((f) => isPrivateAddress(f.address));
                const ok = found[0];
                if (bad || !ok) return answer(new Error(`${host} resolves to a private address`));
                if ((lookupOptions as { all?: boolean }).all) answer(null, found);
                else answer(null, ok.address, ok.family);
              },
              (error: unknown) => answer(error as Error),
            );
          },
        },
        (res) => {
          res.resume();
          done({ status: res.statusCode ?? 0 });
        },
      );
      req.on("timeout", () => req.destroy(new Error("the endpoint did not answer in time")));
      req.on("error", fail);
      req.end(request.body);
    });
}
