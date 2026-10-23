/** The default collection is named by the database in the account's language at creation; shown, it follows the language being read. */
const DEFAULT_NAME = /^(?:My documents|Mes documents)(?: (\d+))?$/;

export function collectionLabel(name: string, isDefault: boolean, mine: string): string {
  const match = isDefault ? DEFAULT_NAME.exec(name) : null;
  return match ? (match[1] ? `${mine} ${match[1]}` : mine) : name;
}
