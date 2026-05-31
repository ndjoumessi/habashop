// Tous les jours "YYYY-MM-DD" de `from` à `to` INCLUS (UTC, sans dérive de fuseau).
// Pur + testable. Borne dure 366 j. Miroir backend du helper frontend (hrShared).
export function eachDateInclusive(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return []
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return []
  const out: string[] = []
  const d = new Date(start)
  let guard = 0
  while (d <= end && guard++ < 366) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}
