/**
 * Two presses to refuse (krizaka-ts ADR-003 § 2, `confirm`): a move that asks for it is only armed by the first press and sent by the
 * second, on the same target; pressing anything else disarms it. Pure, so the rule is tested without a browser.
 */
export function press(armed: string | null, to: string, confirm: boolean): { armed: string | null; send: boolean } {
  if (!confirm) return { armed: null, send: true };
  return armed === to ? { armed: null, send: true } : { armed: to, send: false };
}
