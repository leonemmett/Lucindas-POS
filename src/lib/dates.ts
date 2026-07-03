export function toLocalDateString(isoString: string): string {
  const d = new Date(isoString)
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10)
}

export function todayLocalDateString(): string {
  return toLocalDateString(new Date().toISOString())
}

export function addDaysLocal(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function startOfWeekLocal(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? 6 : day - 1 // days since Monday
  return addDaysLocal(dateStr, -diff)
}

export function startOfMonthLocal(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}

// endDateStr is inclusive; returns ISO bounds with an exclusive end (next day midnight).
export function localDateRangeToISO(startDateStr: string, endDateStr: string) {
  const startISO = new Date(`${startDateStr}T00:00:00`).toISOString()
  const endISO = new Date(`${addDaysLocal(endDateStr, 1)}T00:00:00`).toISOString()
  return { startISO, endISO }
}
