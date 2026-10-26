/**
 * Nothing that carries a credential reaches a log (yomizaka#386). A start-up error once printed the whole connection
 * string, password included, because Node's `ERR_INVALID_URL` keeps the rejected input on the error object.
 */

/** A URL with credentials (`scheme://user:pass@host…`). */
const CREDENTIAL_URL = /\b[a-z][a-z0-9+.-]*:\/\/[^\s'"/@]*@[^\s'"]*/gi;
/** Any connection string of a database, credentials or not. */
const DATABASE_URL = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/[^\s'"]*/gi;
const KEY_VALUE_PAIR = /\b(password|passwd|pwd|secret|token|api[_-]?key)=([^\s&'"]+)/gi;

export const REDACTED = "[redacted]";

/** The text with every URL that carries credentials, every database address and every `key=value` pair of a credential replaced. */
export function redactSecrets(text: string): string {
  return text
    .replace(CREDENTIAL_URL, REDACTED)
    .replace(DATABASE_URL, REDACTED)
    .replace(KEY_VALUE_PAIR, (_all, key: string) => `${key}=${REDACTED}`);
}

/**
 * An error as one safe line: its name, its code and its message (and its cause's), redacted. The error object itself is
 * never printed — its properties (`input`, `config`…) can hold what its message does not.
 */
export function describeError(error: unknown, depth = 0): string {
  if (!(error instanceof Error)) return redactSecrets(typeof error === "string" ? error : "unknown error");
  const code = (error as { code?: unknown }).code;
  const head = `${error.name}${typeof code === "string" ? ` [${code}]` : ""}: ${redactSecrets(error.message)}`;
  return depth < 2 && error.cause ? `${head} (cause: ${describeError(error.cause, depth + 1)})` : head;
}

/** A fresh error whose message is safe to print and which keeps no reference to the original (no `cause`, no `input`). */
export function sanitizedError(error: unknown): Error {
  return new Error(describeError(error));
}
