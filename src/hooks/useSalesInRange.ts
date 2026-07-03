import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { localDateRangeToISO } from '../lib/dates'
import type { Sale } from '../lib/types'

export function useSalesInRange(startDate: string, endDate: string) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { startISO, endISO } = localDateRangeToISO(startDate, endDate)
    const { data } = await supabase
      .from('sales')
      .select('*')
      .gte('ts', startISO)
      .lt('ts', endISO)
      .order('ts', { ascending: false })

    setSales((data as Sale[]) ?? [])
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => {
    load()
  }, [load])

  return { sales, loading, refetch: load }
}
