import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type FixedCost = {
  id: string
  category: string
  amount: number
  effective_from: string
  created_at: string
}

export function useFixedCosts() {
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('fixed_costs')
      .select('*')
      .order('effective_from', { ascending: false })
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setFixedCosts(data as FixedCost[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { fixedCosts, loading, error, refetch: load }
}
