/** How long a password must be — in a module of its own so a form in the browser can read it without pulling the hashing (node:crypto) into its bundle. */
// @fixed: the length the account adapter (@krizaka/auth) requires
export const PASSWORD_MIN_LENGTH = 12;
// @fixed: the longest password the adapter accepts
export const PASSWORD_MAX_LENGTH = 256;
