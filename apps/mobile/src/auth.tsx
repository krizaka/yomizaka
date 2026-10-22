import * as React from "react";

import { session, yomizaka } from "./config";

/** Who is using the app: `loading` while the stored session is read, then one of the two. */
export const AUTH = { loading: "loading", signedOut: "signedOut", signedIn: "signedIn" } as const;
export type AuthStatus = (typeof AUTH)[keyof typeof AUTH];

interface AuthState {
  status: AuthStatus;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>(AUTH.loading);
  const read = React.useCallback(() => session.readToken().then((token) => setStatus(token ? AUTH.signedIn : AUTH.signedOut)), []);
  // The session ends on its own too: the server refused the token, a 401 cleared it.
  React.useEffect(() => {
    void read();
    return session.onChange(() => void read());
  }, [read]);
  const value = React.useMemo<AuthState>(
    () => ({
      status,
      signIn: async (email, password) => void (await yomizaka.signIn(email, password)),
      signOut: yomizaka.signOut,
    }),
    [status],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = React.useContext(AuthContext);
  if (!value) throw new Error("useAuth needs an AuthProvider");
  return value;
}
