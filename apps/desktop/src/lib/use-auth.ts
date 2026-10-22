import { useEffect, useState } from "react";

import { session } from "./config";

export const AUTH = { loading: "loading", signedOut: "signedOut", signedIn: "signedIn" } as const;
export type AuthStatus = (typeof AUTH)[keyof typeof AUTH];

/** Who is using the app: read from the Keychain, and followed when the session ends (a 401 clears it). */
export function useAuth(): AuthStatus {
  const [status, setStatus] = useState<AuthStatus>(AUTH.loading);
  useEffect(() => {
    const read = () => void session.readToken().then((token) => setStatus(token ? AUTH.signedIn : AUTH.signedOut));
    read();
    return session.onChange(read);
  }, []);
  return status;
}
