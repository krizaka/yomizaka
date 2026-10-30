import { clientIp } from "@krizaka/auth";

/**
 * The client's address as far as this deployment can trust it (`@krizaka/auth`'s `clientIp`): the header the edge sets
 * (`ABUSE_CLIENT_IP_HEADER`, e.g. `do-connecting-ip`), else the entry `ABUSE_TRUSTED_PROXY_HOPS` from the right of `X-Forwarded-For`, else `X-Real-IP`.
 */
export function clientAddress(
  headers: Headers,
  source: Record<string, string | undefined> = process.env,
): string | null {
  return clientIp(headers, {
    header: source.ABUSE_CLIENT_IP_HEADER,
    trustedProxyHops: Number(source.ABUSE_TRUSTED_PROXY_HOPS) || undefined,
  });
}
