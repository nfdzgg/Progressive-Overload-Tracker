/** A new UUID string. */
export function newId(): string {
  return crypto.randomUUID();
}
