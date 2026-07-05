import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Cashup } from '../lib/types'

export function useCashupHistory() {
  const [cashups, setCashups] = useState<Cashup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('cashups').select('*').order('date', { ascending: false })
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setCashups(data as Cashup[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { cashups, loading, error, refetch: load }
}
