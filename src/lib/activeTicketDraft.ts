import type { TicketLine } from './types'

// Local safety net for the in-progress cart, so a power cut or Wi-Fi drop
// that kills the debounced open_tickets sync to Supabase (or restarts the
// browser/tablet entirely) doesn't lose an order in progress. This is
// best-effort and device-local — Supabase's open_tickets table remains the
// source of truth once connectivity is back.
//
// Stores a full snapshot of each line's menu item (not just its id) so
// recovery never depends on re-fetching the menu catalog from Supabase —
// if the whole app reloads mid-outage, that fetch would fail too.
const STORAGE_KEY = 'lucindas-pos:active-ticket-draft'

export type ActiveTicketDraftLine = Omit<TicketLine, 'key'>

export type ActiveTicketDraft = {
  tableId: string | null
  lines: ActiveTicketDraftLine[]
  savedAt: string
}

export function readActiveTicketDraft(): ActiveTicketDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveTicketDraft
    if (!Array.isArray(parsed.lines)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeActiveTicketDraft(tableId: string | null, lines: TicketLine[]) {
  try {
    const draft: ActiveTicketDraft = {
      tableId,
      lines: lines.map(({ menuItem, qty, flavors }) => ({ menuItem, qty, flavors })),
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Storage can be unavailable (private browsing, quota) — the in-memory
    // cart and the Supabase sync still work, this is only a best-effort
    // local backup.
  }
}
