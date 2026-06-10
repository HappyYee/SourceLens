/** UTF-16-safe fixed-length truncation for strings that may be persisted. */
export function truncate(s: string, max: number): string {
  const cut = s.length > max ? s.slice(0, max) : s;
  return cut.isWellFormed() ? cut : cut.toWellFormed();
}
