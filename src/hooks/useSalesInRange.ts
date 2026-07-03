import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { localDateRangeToISO } from '../lib/dates'
import type { Sale } from '../lib/types'

export function useSalesInRange(startDate: string, endDate: string) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { startISO, endISO } = localDateRangeToISO(startDate, endDate)
      const { data } = await supabase
        .from('sales')
        .select('*')
        .gte('ts', startISO)
        .lt('ts', endISO)
        .order('ts', { ascending: false })

      if (!cancelled) {
        setSales((data as Sale[]) ?? [])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [startDate, endDate])

  return { sales, loading }
}
