import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type StocktakeLine = {
  id: string
  stocktake_id: string
  ingredient_id: string
  ingredient_name: string
  system_stock_before: number
  counted_stock: number
  difference: number
  created_at: string
}

export function useStocktakeLines() {
  const [lines, setLines] = useState<StocktakeLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('stocktake_lines').select('*')
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setLines(data as StocktakeLine[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { lines, loading, error, refetch: load }
}
