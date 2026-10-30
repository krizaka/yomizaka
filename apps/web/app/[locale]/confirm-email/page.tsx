import { isEmailChangeToken } from "@krizaka/auth";
import type { Metadata } from "next";

import { emailTokenMetadata, EmailTokenPage } from "@/components/EmailTokenPage";

export const dynamic = "force-dynamic";

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> =>
  emailTokenMetadata(params, "confirmEmail");

/** The mailed link of an address change lands here. */
export default function ConfirmEmail(
  props: Readonly<{ params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }>,
) {
  return (
    <EmailTokenPage
      {...props}
      kind="confirmEmail"
      isToken={(value): value is string => isEmailChangeToken("ye", value)}
      action="/api/auth/confirm-email"
    />
  );
}
