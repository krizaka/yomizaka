import { useSessionStatus } from "@krizaka/app-client/react";

import { session } from "./config";

export { AUTH } from "@krizaka/app-client/react";

/** Who is using the Mac app: read from the Keychain, followed when the session ends (a 401 clears it). */
export const useAuth = () => useSessionStatus(session);
