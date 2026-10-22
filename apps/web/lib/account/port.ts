/**
 * The account PORT (ADR-0008). A product's account and profile — name, language, avatar, e-mail change with verification,
 * password, deletion — behind one interface, with no vendor and no product code: it is written to move into a shared
 * TypeScript building block (`@krizaka/auth`) that each product uses with its OWN data store (products stay independent:
 * their own database, accounts and customers, no runtime dependency on a central service). Yomizaka's adapter is
 * `lib/account/postgres.ts`; another product, or the shared package, brings its own.
 */
export interface AccountProfile {
  id: string;
  email: string;
  name: string | null;
  locale: "en" | "fr";
  /** A seed of the default avatars (the UI draws it); null = derived from the e-mail address. */
  avatarSeed: string | null;
  emailVerified: boolean;
  /** An address awaiting its verification link, if the person asked to change it. */
  pendingEmail: string | null;
}

export interface ProfilePatch {
  name?: string | null;
  locale?: "en" | "fr";
  avatarSeed?: string | null;
}

export interface AccountService {
  profile(accountId: string): Promise<AccountProfile>;
  updateProfile(accountId: string, patch: ProfilePatch): Promise<AccountProfile>;
  /** Asks to change the address: the password is checked, a link is mailed to the NEW address. Answers the same whether or not it is already taken (no enumeration). */
  requestEmailChange(accountId: string, input: { newEmail: string; password: string }, now: Date): Promise<void>;
  /** Applies the change from the mailed link (single use, expires); the new address is verified by that very act. */
  confirmEmailChange(token: string, now: Date): Promise<"CHANGED" | "INVALID">;
  /** Changes the password (the current one is checked) and signs every other session out; `keepSessionId` stays. */
  changePassword(accountId: string, input: { current: string; next: string }, keepSessionId?: string): Promise<void>;
  /** Checks the password. Throws `AccountError(403, "WRONG_PASSWORD")`. */
  confirmPassword(accountId: string, password: string): Promise<void>;
  /** Deletes the identity: the account, its sessions and everything that hangs on it (the product erases its own data first). */
  deleteAccount(accountId: string): Promise<void>;
}

export class AccountError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AccountError";
  }
}
