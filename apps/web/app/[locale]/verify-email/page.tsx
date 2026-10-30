import type { Metadata } from "next";

import { emailTokenMetadata, EmailTokenPage } from "@/components/EmailTokenPage";
import { isVerifyToken } from "@/lib/signup";

export const dynamic = "force-dynamic";

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> =>
  emailTokenMetadata(params, "verifyEmail");

/** The mailed link of a sign-up lands here. */
export default function VerifyEmail(
  props: Readonly<{ params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }>,
) {
  return <EmailTokenPage {...props} kind="verifyEmail" isToken={isVerifyToken} action="/api/auth/verify-email" />;
}
