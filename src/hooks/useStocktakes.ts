import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type Stocktake = {
  id: string
  taken_at: string
  note: string | null
  created_at: string
}

export function useStocktakes() {
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('stocktakes')
      .select('*')
      .order('taken_at', { ascending: false })
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setStocktakes(data as Stocktake[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { stocktakes, loading, error, refetch: load }
}
