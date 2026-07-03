import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { localDateRangeToISO } from '../lib/dates'

export type SalesTotals = {
  cash: number
  card1: number
  card2: number
  transfer: number
}

export function useSalesTotalsForDate(dateStr: string) {
  const [totals, setTotals] = useState<SalesTotals>({ cash: 0, card1: 0, card2: 0, transfer: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { startISO, endISO } = localDateRangeToISO(dateStr, dateStr)
      const { data } = await supabase.from('sales').select('payment, total').gte('ts', startISO).lt('ts', endISO)

      if (cancelled) return
      const next: SalesTotals = { cash: 0, card1: 0, card2: 0, transfer: 0 }
      for (const row of data ?? []) {
        if (row.payment in next) {
          next[row.payment as keyof SalesTotals] += row.total
        }
      }
      setTotals(next)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [dateStr])

  return { totals, loading }
}
