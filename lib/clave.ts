export function nuevaClave(): string {
  return crypto.randomUUID();
}
