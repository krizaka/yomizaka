import type { Metadata } from "next";

import { emailTokenMetadata,EmailTokenPage } from "@/components/EmailTokenPage";
import { isEmailChangeToken } from "@/lib/account/postgres";

export const dynamic = "force-dynamic";

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => emailTokenMetadata(params, "confirmEmail");

/** The mailed link of an address change lands here. */
export default function ConfirmEmail(props: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  return <EmailTokenPage {...props} kind="confirmEmail" isToken={isEmailChangeToken} action="/api/auth/confirm-email" />;
}
