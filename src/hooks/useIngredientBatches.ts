import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { IngredientBatch } from '../lib/types'

export function useIngredientBatches() {
  const [batches, setBatches] = useState<IngredientBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ingredient_batches')
      .select('*')
      .order('expiry_date', { ascending: true, nullsFirst: false })
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setBatches(data as IngredientBatch[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { batches, loading, error, refetch: load }
}
