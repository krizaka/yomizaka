import { createAuth } from "@krizaka/app-client/react";

import { session, yomizaka } from "./config";

/** Who is using the app, followed when a session starts or ends (a 401 included): `@krizaka/app-client/react`. */
export const { AuthProvider, useAuth } = createAuth(session, { signIn: yomizaka.signIn, signOut: yomizaka.signOut });
export { AUTH } from "@krizaka/app-client/react";
